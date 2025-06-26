const express = require("express");
const Invoice = require("../models/Invoice");
const { validateInvoiceUpdate } = require("../utils/validation");

const router = express.Router();

/**
 * GET /api/invoices - Get all invoices with filtering and pagination
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};

    if (req.query.vendor) {
      filter.vendor = { $regex: req.query.vendor, $options: "i" };
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.needsReview === "true") {
      filter["validationStatus.needsReview"] = true;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) {
        filter.date.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.date.$lte = new Date(req.query.dateTo);
      }
    }

    if (req.query.amountMin || req.query.amountMax) {
      filter.amount = {};
      if (req.query.amountMin) {
        filter.amount.$gte = parseFloat(req.query.amountMin);
      }
      if (req.query.amountMax) {
        filter.amount.$lte = parseFloat(req.query.amountMax);
      }
    }

    // Get total count for pagination
    const total = await Invoice.countDocuments(filter);

    // Get invoices
    const invoices = await Invoice.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-rawText") // Exclude large text field from list
      .lean();

    // Add computed fields
    const enrichedInvoices = invoices.map((invoice) => ({
      ...invoice,
      formattedDate: new Date(invoice.date).toLocaleDateString("en-US"),
      formattedAmount: `$${invoice.amount.toFixed(2)}`,
      requiresReview:
        invoice.validationStatus.needsReview ||
        invoice.validationStatus.overallConfidence < 70,
    }));

    res.json({
      invoices: enrichedInvoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      summary: {
        totalInvoices: total,
        needsReview: await Invoice.countDocuments({
          ...filter,
          "validationStatus.needsReview": true,
        }),
        totalAmount: await Invoice.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).then((result) => result[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      error: "Failed to fetch invoices",
      message: error.message,
    });
  }
});

/**
 * GET /api/invoices/:id - Get single invoice
 */
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    // Check for potential duplicates
    const duplicates = await Invoice.findPotentialDuplicates(
      invoice.vendor,
      invoice.amount,
      invoice.date
    );

    res.json({
      ...invoice.toObject(),
      formattedDate: invoice.date.toLocaleDateString("en-US"),
      formattedAmount: `$${invoice.amount.toFixed(2)}`,
      requiresReview: invoice.requiresReview(),
      potentialDuplicates: duplicates
        .filter((d) => d._id.toString() !== invoice._id.toString())
        .map((d) => ({
          id: d._id,
          vendor: d.vendor,
          date: d.date,
          amount: d.amount,
          formattedDate: d.date.toLocaleDateString("en-US"),
          formattedAmount: `$${d.amount.toFixed(2)}`,
        })),
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({
      error: "Failed to fetch invoice",
      message: error.message,
    });
  }
});

/**
 * PUT /api/invoices/:id - Update invoice
 */
router.put("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    // Validate update data
    const validation = validateInvoiceUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Validation failed",
        message: validation.error,
        details: validation.details,
      });
    }

    // Track if user made corrections
    const wasUserCorrected = invoice.userCorrected;
    const hasChanges = Object.keys(validation.data).some((key) => {
      if (key === "extractedData") {
        return (
          JSON.stringify(invoice[key]) !== JSON.stringify(validation.data[key])
        );
      }
      return invoice[key] !== validation.data[key];
    });

    if (hasChanges) {
      invoice.userCorrected = true;

      // Update learning system if category changed
      if (
        validation.data.category &&
        validation.data.category !== invoice.category
      ) {
        await updateVendorLearning(invoice.vendor, validation.data.category);
      }
    }

    // Update invoice fields
    Object.assign(invoice, validation.data);

    // Re-validate after update
    const { validateInvoiceData } = require("../utils/validation");
    const newValidation = await validateInvoiceData(
      {
        vendor: invoice.vendor,
        date: invoice.date,
        amount: invoice.amount,
        lineItems: invoice.extractedData.lineItems,
        tax: invoice.extractedData.tax,
        subtotal: invoice.extractedData.subtotal,
      },
      invoice.fileMetadata
    );

    invoice.validationStatus = {
      dateValid: newValidation.dateValid,
      amountValid: newValidation.amountValid,
      vendorValid: newValidation.vendorValid,
      overallConfidence: newValidation.overallConfidence,
      issues: newValidation.issues,
      needsReview: newValidation.needsReview,
    };

    await invoice.save();

    res.json({
      success: true,
      invoice: {
        ...invoice.toObject(),
        formattedDate: invoice.date.toLocaleDateString("en-US"),
        formattedAmount: `${invoice.amount.toFixed(2)}`,
        requiresReview: invoice.requiresReview(),
      },
      message: hasChanges ? "Invoice updated successfully" : "No changes made",
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({
      error: "Failed to update invoice",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/invoices/:id - Delete invoice
 */
router.delete("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    // Delete associated file
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join(
      process.env.UPLOAD_DIR || "./uploads",
      invoice.fileMetadata.fileName
    );

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
      // Continue with invoice deletion even if file deletion fails
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({
      error: "Failed to delete invoice",
      message: error.message,
    });
  }
});

/**
 * POST /api/invoices/:id/mark-duplicate - Mark invoice as duplicate
 */
router.post("/:id/mark-duplicate", async (req, res) => {
  try {
    const { originalId } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    const original = await Invoice.findById(originalId);

    if (!invoice || !original) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    invoice.isDuplicate = true;
    invoice.duplicateOf = originalId;
    await invoice.save();

    res.json({
      success: true,
      message: "Invoice marked as duplicate",
    });
  } catch (error) {
    console.error("Error marking duplicate:", error);
    res.status(500).json({
      error: "Failed to mark duplicate",
      message: error.message,
    });
  }
});

/**
 * GET /api/invoices/:id/duplicates - Get potential duplicates for an invoice
 */
router.get("/:id/duplicates", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    const duplicates = await Invoice.findPotentialDuplicates(
      invoice.vendor,
      invoice.amount,
      invoice.date
    );

    const potentialDuplicates = duplicates
      .filter((d) => d._id.toString() !== invoice._id.toString())
      .map((d) => ({
        id: d._id,
        vendor: d.vendor,
        date: d.date,
        amount: d.amount,
        formattedDate: d.date.toLocaleDateString("en-US"),
        formattedAmount: `${d.amount.toFixed(2)}`,
        confidence: calculateDuplicateConfidence(invoice, d),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    res.json({
      duplicates: potentialDuplicates,
    });
  } catch (error) {
    console.error("Error finding duplicates:", error);
    res.status(500).json({
      error: "Failed to find duplicates",
      message: error.message,
    });
  }
});

/**
 * POST /api/invoices/bulk-action - Perform bulk actions on invoices
 */
router.post("/bulk-action", async (req, res) => {
  try {
    const { action, invoiceIds, data } = req.body;

    if (!action || !invoiceIds || !Array.isArray(invoiceIds)) {
      return res.status(400).json({
        error: "Invalid bulk action request",
      });
    }

    let result;

    switch (action) {
      case "delete":
        result = await bulkDelete(invoiceIds);
        break;
      case "updateCategory":
        if (!data.category) {
          return res.status(400).json({
            error: "Category is required for bulk update",
          });
        }
        result = await bulkUpdateCategory(invoiceIds, data.category);
        break;
      case "markReviewed":
        result = await bulkMarkReviewed(invoiceIds);
        break;
      default:
        return res.status(400).json({
          error: "Unknown bulk action",
        });
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error performing bulk action:", error);
    res.status(500).json({
      error: "Failed to perform bulk action",
      message: error.message,
    });
  }
});

/**
 * Helper function to update vendor learning system
 */
async function updateVendorLearning(vendor, category) {
  // This would be implemented with a proper learning database
  // For now, we'll log the learning event
  console.log(`Learning: ${vendor} -> ${category}`);

  // In a full implementation, you'd:
  // 1. Find or create vendor mapping record
  // 2. Increment usage count
  // 3. Update confidence scores
  // 4. Handle conflicting categorizations
}

/**
 * Calculate duplicate confidence score
 */
function calculateDuplicateConfidence(invoice1, invoice2) {
  let confidence = 0;

  // Exact amount match
  if (invoice1.amount === invoice2.amount) {
    confidence += 40;
  } else {
    const amountDiff =
      Math.abs(invoice1.amount - invoice2.amount) /
      Math.max(invoice1.amount, invoice2.amount);
    if (amountDiff < 0.05) confidence += 30; // Within 5%
    else if (amountDiff < 0.1) confidence += 20; // Within 10%
  }

  // Vendor similarity
  const vendor1 = invoice1.vendor.toLowerCase();
  const vendor2 = invoice2.vendor.toLowerCase();
  if (vendor1 === vendor2) {
    confidence += 30;
  } else if (vendor1.includes(vendor2) || vendor2.includes(vendor1)) {
    confidence += 20;
  }

  // Date proximity
  const dateDiff =
    Math.abs(invoice1.date - invoice2.date) / (1000 * 60 * 60 * 24); // days
  if (dateDiff === 0) confidence += 30;
  else if (dateDiff <= 1) confidence += 20;
  else if (dateDiff <= 7) confidence += 10;

  return Math.min(100, confidence);
}

/**
 * Bulk action helpers
 */
async function bulkDelete(invoiceIds) {
  const invoices = await Invoice.find({ _id: { $in: invoiceIds } });

  // Delete associated files
  const fs = require("fs");
  const path = require("path");

  for (const invoice of invoices) {
    try {
      const filePath = path.join(
        process.env.UPLOAD_DIR || "./uploads",
        invoice.fileMetadata.fileName
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  const result = await Invoice.deleteMany({ _id: { $in: invoiceIds } });

  return {
    deleted: result.deletedCount,
    message: `${result.deletedCount} invoices deleted`,
  };
}

async function bulkUpdateCategory(invoiceIds, category) {
  const result = await Invoice.updateMany(
    { _id: { $in: invoiceIds } },
    {
      $set: {
        category,
        userCorrected: true,
      },
    }
  );

  return {
    updated: result.modifiedCount,
    message: `${result.modifiedCount} invoices updated`,
  };
}

async function bulkMarkReviewed(invoiceIds) {
  const result = await Invoice.updateMany(
    { _id: { $in: invoiceIds } },
    {
      $set: {
        "validationStatus.needsReview": false,
        userCorrected: true,
      },
    }
  );

  return {
    updated: result.modifiedCount,
    message: `${result.modifiedCount} invoices marked as reviewed`,
  };
}

module.exports = router;

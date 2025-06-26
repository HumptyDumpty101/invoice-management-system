// backend/routes/upload.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  extractText,
  validateExtractionQuality,
} = require("../utils/textExtraction");
const { parseInvoiceData, extractMetadata } = require("../utils/dataParser");
const { validateInvoiceData } = require("../utils/validation");
const Invoice = require("../models/Invoice");

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];
  const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Allowed types: ${allowedExts.join(", ")}`),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5, // Allow up to 5 files at once
  },
});

/**
 * POST /api/upload - Upload and process invoice(s)
 */
router.post("/", upload.array("invoices", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No files uploaded",
        message: "Please select at least one invoice file to upload",
      });
    }

    const results = [];
    const errors = [];

    // Process each uploaded file
    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname} (${file.mimetype})`);
        const result = await processInvoiceFile(file);
        results.push(result);
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message,
          details: error.stack,
        });

        // Clean up failed file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
    }

    // Return results
    const response = {
      success: results.length > 0,
      processed: results.length,
      total: req.files.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      processingInfo: {
        totalProcessingTime: results.reduce(
          (sum, r) => sum + r.processingTime,
          0
        ),
        averageConfidence:
          results.length > 0
            ? Math.round(
                results.reduce((sum, r) => sum + r.confidence, 0) /
                  results.length
              )
            : 0,
        ocrUsed: results.some((r) => r.extractionMethod?.includes("ocr")),
        pdfUsed: results.some((r) => r.extractionMethod === "pdf"),
      },
    };

    const statusCode = results.length > 0 ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Upload error:", error);

    // Clean up all uploaded files on error
    if (req.files) {
      req.files.forEach((file) => {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      });
    }

    res.status(500).json({
      error: "Upload processing failed",
      message: error.message,
    });
  }
});

/**
 * Process a single invoice file
 */
async function processInvoiceFile(file) {
  const startTime = Date.now();

  // Extract file information
  const fileType = path.extname(file.originalname).toLowerCase().substring(1);
  const fileStats = fs.statSync(file.path);

  // Step 1: Extract text from file
  const extraction = await extractText(file.path, fileType);

  // Step 2: Validate extraction quality
  const qualityCheck = validateExtractionQuality(extraction);

  // Step 3: Parse structured data
  const parsedData = parseInvoiceData(extraction.text, extraction.metadata);

  // Step 4: Extract additional metadata
  const additionalMetadata = extractMetadata(extraction.text);

  // Step 5: Validate parsed data
  const validation = await validateInvoiceData(parsedData, {
    ocrConfidence: extraction.confidence,
    fileType,
    pageCount: extraction.pageCount,
  });

  // Step 6: Check for potential duplicates
  const potentialDuplicates = await Invoice.findPotentialDuplicates(
    parsedData.vendor,
    parsedData.amount,
    parsedData.date
  );

  // Step 7: Predict category
  const categoryPrediction = await predictCategory(
    parsedData.vendor,
    parsedData.amount
  );

  // Step 8: Create invoice record
  const invoice = new Invoice({
    vendor: parsedData.vendor,
    date: parsedData.date,
    amount: parsedData.amount,
    category: categoryPrediction ? categoryPrediction.category : "5000", // Default category
    categoryConfidence: categoryPrediction ? categoryPrediction.confidence : 0,
    rawText: extraction.text,
    extractedData: {
      lineItems: parsedData.lineItems,
      tax: parsedData.tax,
      subtotal: parsedData.subtotal,
      currency: "USD",
    },
    validationStatus: {
      dateValid: validation.dateValid,
      amountValid: validation.amountValid,
      vendorValid: validation.vendorValid,
      overallConfidence: validation.overallConfidence,
      issues: validation.issues,
      needsReview: validation.needsReview || qualityCheck.needsReview,
    },
    fileMetadata: {
      originalName: file.originalname,
      fileName: file.filename,
      fileType,
      fileSize: fileStats.size,
      pageCount: extraction.pageCount,
      ocrConfidence: extraction.confidence,
    },
    processingMetadata: {
      extractionMethod: extraction.extractionMethod,
      processingTime: Date.now() - startTime,
      retryCount: 0,
      version: "1.0",
    },
    isDuplicate: potentialDuplicates.length > 0,
    duplicateOf:
      potentialDuplicates.length > 0 ? potentialDuplicates[0]._id : null,
  });

  await invoice.save();

  return {
    id: invoice._id,
    vendor: invoice.vendor,
    date: invoice.date,
    amount: invoice.amount,
    category: invoice.category,
    categoryPrediction,
    confidence: validation.overallConfidence,
    needsReview: invoice.validationStatus.needsReview,
    issues: validation.issues,
    isDuplicate: invoice.isDuplicate,
    duplicateCount: potentialDuplicates.length,
    processingTime: invoice.processingMetadata.processingTime,
  };
}

/**
 * Simple category prediction based on vendor
 * This will be enhanced with a proper learning system
 */
async function predictCategory(vendor, amount) {
  // Simple rule-based prediction for demo
  const vendorLower = vendor.toLowerCase();

  const predictions = {
    amazon: { category: "5010", name: "Office Supplies", confidence: 85 },
    uber: { category: "5040", name: "Travel & Transportation", confidence: 90 },
    starbucks: {
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 80,
    },
    "office depot": {
      category: "5010",
      name: "Office Supplies",
      confidence: 95,
    },
    walmart: { category: "5010", name: "Office Supplies", confidence: 70 },
    target: { category: "5010", name: "Office Supplies", confidence: 70 },
    "best buy": { category: "5060", name: "Technology", confidence: 85 },
    "home depot": {
      category: "5070",
      name: "Maintenance & Repairs",
      confidence: 85,
    },
  };

  for (const [vendor_key, prediction] of Object.entries(predictions)) {
    if (vendorLower.includes(vendor_key)) {
      return prediction;
    }
  }

  // Default prediction based on amount ranges
  if (amount < 20) {
    return { category: "5050", name: "Meals & Entertainment", confidence: 60 };
  } else if (amount < 100) {
    return { category: "5010", name: "Office Supplies", confidence: 50 };
  } else {
    return { category: "5060", name: "Professional Services", confidence: 40 };
  }
}

/**
 * GET /api/upload/status - Check upload processing status
 */
router.get("/status", (req, res) => {
  res.json({
    status: "ready",
    maxFileSize: process.env.MAX_FILE_SIZE || 10485760,
    allowedTypes: ["pdf", "jpg", "jpeg", "png"],
    maxFiles: 5,
  });
});

module.exports = router;

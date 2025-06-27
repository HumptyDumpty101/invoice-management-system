const express = require("express");
const Invoice = require("../models/Invoice");
const Category = require("../models/Category");
const router = express.Router();

/**
 * GET /api/dashboard/stats - Get dashboard statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const { period = "30" } = req.query; // Default to last 30 days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const [
      totalStats,
      periodStats,
      categoryBreakdown,
      recentInvoices,
      needsReviewCount,
      duplicatesCount,
      monthlyTrends,
    ] = await Promise.all([
      // Total statistics (all time)
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
            maxAmount: { $max: "$amount" },
            minAmount: { $min: "$amount" },
          },
        },
      ]),

      // Period statistics
      Invoice.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            periodInvoices: { $sum: 1 },
            periodAmount: { $sum: "$amount" },
            periodAvg: { $avg: "$amount" },
          },
        },
      ]),

      // Category breakdown for the period
      Invoice.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            avgAmount: { $avg: "$amount" },
          },
        },
        {
          $sort: { totalAmount: -1 },
        },
        {
          $limit: 10,
        },
      ]),

      // Recent invoices
      Invoice.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("vendor date amount category validationStatus.needsReview")
        .lean(),

      // Invoices needing review
      Invoice.countDocuments({
        "validationStatus.needsReview": true,
      }),

      // Potential duplicates
      Invoice.countDocuments({
        isDuplicate: true,
      }),

      // Monthly trends (last 6 months)
      Invoice.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ]),
    ]);

    // Get category names for breakdown
    const categoryBreakdownWithNames = await enrichCategoryBreakdown(
      categoryBreakdown
    );

    // Format response
    const stats = {
      summary: {
        totalInvoices: totalStats[0]?.totalInvoices || 0,
        totalAmount: totalStats[0]?.totalAmount || 0,
        avgAmount: totalStats[0]?.avgAmount || 0,
        maxAmount: totalStats[0]?.maxAmount || 0,
        minAmount: totalStats[0]?.minAmount || 0,
        periodInvoices: periodStats[0]?.periodInvoices || 0,
        periodAmount: periodStats[0]?.periodAmount || 0,
        periodAvg: periodStats[0]?.periodAvg || 0,
        needsReview: needsReviewCount,
        duplicates: duplicatesCount,
      },
      categoryBreakdown: categoryBreakdownWithNames,
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice._id,
        vendor: invoice.vendor,
        date: invoice.date,
        amount: invoice.amount,
        category: invoice.category,
        needsReview: invoice.validationStatus?.needsReview || false,
        formattedDate: new Date(invoice.date).toLocaleDateString("en-US"),
        formattedAmount: `${invoice.amount.toFixed(2)}`,
      })),
      monthlyTrends: monthlyTrends.map((trend) => ({
        month: `${trend._id.year}-${String(trend._id.month).padStart(2, "0")}`,
        monthName: new Date(
          trend._id.year,
          trend._id.month - 1
        ).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        count: trend.count,
        totalAmount: trend.totalAmount,
        avgAmount: trend.totalAmount / trend.count,
      })),
      period: {
        days: parseInt(period),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard statistics",
      message: error.message,
    });
  }
});

/**
 * GET /api/dashboard/export - Export invoices as CSV
 */
router.get("/export", async (req, res) => {
  try {
    const { startDate, endDate, category, vendor, format = "csv" } = req.query;

    // Build filter
    const filter = {};

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (category) filter.category = category;
    if (vendor) filter.vendor = { $regex: vendor, $options: "i" };

    console.log("Export filter:", filter);

    const invoices = await Invoice.find(filter).sort({ date: -1 }).lean();

    // FIXED: Add null check and ensure it's an array
    const safeInvoices = invoices || [];

    console.log(`Found ${safeInvoices.length} invoices for export`);

    if (format === "csv") {
      const csv = await generateCSV(safeInvoices); // Pass safe array

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invoices-${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csv);
    } else {
      res.json({
        invoices: safeInvoices.map((invoice) => ({
          id: invoice._id,
          vendor: invoice.vendor,
          date: invoice.date,
          amount: invoice.amount,
          category: invoice.category,
          formattedDate: new Date(invoice.date).toLocaleDateString("en-US"),
          formattedAmount: `${invoice.amount.toFixed(2)}`,
          needsReview: invoice.validationStatus?.needsReview || false,
        })),
        total: safeInvoices.length,
        totalAmount: safeInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      });
    }
  } catch (error) {
    console.error("Error exporting invoices:", error);
    res.status(500).json({
      error: "Failed to export invoices",
      message: error.message,
    });
  }
});

/**
 * Generate CSV from invoices
 */
/**
 * Generate CSV from invoices
 */
async function generateCSV(invoices) {
  // FIXED: Add null check and ensure it's an array
  if (!invoices || !Array.isArray(invoices)) {
    console.error("generateCSV received invalid invoices parameter:", invoices);
    invoices = []; // Default to empty array
  }

  const headers = [
    "Date",
    "Vendor",
    "Amount",
    "Category Code",
    "Category Name",
    "Description",
    "Tax",
    "Subtotal",
    "Needs Review",
    "File Type",
    "Confidence",
    "Created At",
  ];

  // FIXED: Get categories from database instead of trying to import
  const categoryMap = {};
  try {
    const categories = await Category.find({ isActive: true }).lean();

    if (categories && Array.isArray(categories)) {
      categories.forEach((cat) => {
        categoryMap[cat.code] = cat.name;
      });
      console.log(`Loaded ${categories.length} categories for CSV export`);
    }
  } catch (error) {
    console.error("Error loading categories from database for CSV:", error);
    // Fallback to hardcoded categories if database fails
    const fallbackCategories = {
      5010: "Office Supplies",
      5020: "Software Subscriptions",
      5030: "Internet & Phone",
      5040: "Travel & Transportation",
      5050: "Meals & Entertainment",
      5060: "Professional Services",
      5070: "Marketing & Advertising",
      5080: "Rent & Utilities",
      5090: "Insurance",
      5100: "Equipment & Technology",
      5110: "Maintenance & Repairs",
      5120: "Training & Education",
      5130: "Bank Fees",
      5140: "Miscellaneous Expenses",
    };
    Object.assign(categoryMap, fallbackCategories);
  }

  const rows = invoices.map((invoice) => [
    new Date(invoice.date).toLocaleDateString("en-US"),
    `"${(invoice.vendor || "Unknown").replace(/"/g, '""')}"`, // Escape quotes
    (invoice.amount || 0).toFixed(2),
    invoice.category || "5140",
    `"${categoryMap[invoice.category] || "Unknown Category"}"`, // This should now work
    `"${(invoice.extractedData?.lineItems || [])
      .map((item) => item.description || "")
      .join("; ")
      .replace(/"/g, '""')}"`,
    (invoice.extractedData?.tax || 0).toFixed(2),
    (invoice.extractedData?.subtotal || 0).toFixed(2),
    invoice.validationStatus?.needsReview ? "Yes" : "No",
    invoice.fileMetadata?.fileType || "unknown",
    invoice.validationStatus?.overallConfidence || 0,
    new Date(invoice.createdAt).toLocaleDateString("en-US"),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
/**
 * GET /api/dashboard/analytics/:type - Get specific analytics
 */
router.get("/analytics/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { period = "90" } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let analytics;

    switch (type) {
      case "vendors":
        analytics = await getVendorAnalytics(startDate, endDate);
        break;
      case "categories":
        analytics = await getCategoryAnalytics(startDate, endDate);
        break;
      case "trends":
        analytics = await getTrendAnalytics(startDate, endDate);
        break;
      case "accuracy":
        analytics = await getAccuracyAnalytics(startDate, endDate);
        break;
      default:
        return res.status(400).json({
          error: "Invalid analytics type",
          message: "Valid types: vendors, categories, trends, accuracy",
        });
    }

    res.json({
      type,
      period: parseInt(period),
      analytics,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      error: "Failed to fetch analytics",
      message: error.message,
    });
  }
});

/**
 * Helper function to enrich category breakdown with names
 */
async function enrichCategoryBreakdown(breakdown) {
  // Import default categories from categories route
  const { defaultCategories } = require("./categories");

  return breakdown.map((item) => {
    const category = defaultCategories.find((c) => c.code === item._id);
    return {
      categoryCode: item._id,
      categoryName: category ? category.name : "Unknown Category",
      count: item.count,
      totalAmount: item.totalAmount,
      avgAmount: item.avgAmount,
      percentage: 0, // Will be calculated on frontend
    };
  });
}

/**
 * Generate CSV from invoices
 */
// async function generateCSV(invoices) {
//   const headers = [
//     "Date",
//     "Vendor",
//     "Amount",
//     "Category Code",
//     "Category Name",
//     "Description",
//     "Tax",
//     "Subtotal",
//     "Needs Review",
//     "File Type",
//     "Confidence",
//     "Created At",
//   ];

//   // Import default categories for name lookup
//   const categoryMap = {};
//   const { defaultCategories } = require("./categories");
//   defaultCategories.forEach((cat) => {
//     categoryMap[cat.code] = cat.name;
//   });

//   const rows = invoices.map((invoice) => [
//     new Date(invoice.date).toLocaleDateString("en-US"),
//     `"${invoice.vendor.replace(/"/g, '""')}"`, // Escape quotes
//     invoice.amount.toFixed(2),
//     invoice.category,
//     `"${categoryMap[invoice.category] || "Unknown"}"`,
//     `"${(invoice.extractedData?.lineItems || [])
//       .map((item) => item.description)
//       .join("; ")
//       .replace(/"/g, '""')}"`,
//     (invoice.extractedData?.tax || 0).toFixed(2),
//     (invoice.extractedData?.subtotal || 0).toFixed(2),
//     invoice.validationStatus?.needsReview ? "Yes" : "No",
//     invoice.fileMetadata?.fileType || "unknown",
//     invoice.validationStatus?.overallConfidence || 0,
//     new Date(invoice.createdAt).toLocaleDateString("en-US"),
//   ]);

//   return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
// }

/**
 * Analytics helper functions
 */
async function getVendorAnalytics(startDate, endDate) {
  const vendors = await Invoice.aggregate([
    {
      $match: { date: { $gte: startDate, $lte: endDate } },
    },
    {
      $group: {
        _id: "$vendor",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        avgAmount: { $avg: "$amount" },
        categories: { $addToSet: "$category" },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
    {
      $limit: 20,
    },
  ]);

  return vendors.map((vendor) => ({
    vendor: vendor._id,
    count: vendor.count,
    totalAmount: vendor.totalAmount,
    avgAmount: vendor.avgAmount,
    categories: vendor.categories,
    categoryCount: vendor.categories.length,
  }));
}

async function getCategoryAnalytics(startDate, endDate) {
  const categories = await Invoice.aggregate([
    {
      $match: { date: { $gte: startDate, $lte: endDate } },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        avgAmount: { $avg: "$amount" },
        vendors: { $addToSet: "$vendor" },
      },
    },
    {
      $sort: { totalAmount: -1 },
    },
  ]);

  const enriched = await enrichCategoryBreakdown(categories);

  return enriched.map((cat) => ({
    ...cat,
    vendorCount: cat.vendors?.length || 0,
  }));
}

async function getTrendAnalytics(startDate, endDate) {
  const trends = await Invoice.aggregate([
    {
      $match: { date: { $gte: startDate, $lte: endDate } },
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          day: { $dayOfMonth: "$date" },
        },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        avgConfidence: { $avg: "$validationStatus.overallConfidence" },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
    },
  ]);

  return trends.map((trend) => ({
    date: new Date(trend._id.year, trend._id.month - 1, trend._id.day)
      .toISOString()
      .split("T")[0],
    count: trend.count,
    totalAmount: trend.totalAmount,
    avgAmount: trend.totalAmount / trend.count,
    avgConfidence: trend.avgConfidence,
  }));
}

async function getAccuracyAnalytics(startDate, endDate) {
  const accuracy = await Invoice.aggregate([
    {
      $match: { date: { $gte: startDate, $lte: endDate } },
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        needsReview: {
          $sum: {
            $cond: ["$validationStatus.needsReview", 1, 0],
          },
        },
        userCorrected: {
          $sum: {
            $cond: ["$userCorrected", 1, 0],
          },
        },
        avgConfidence: { $avg: "$validationStatus.overallConfidence" },
        avgOcrConfidence: { $avg: "$fileMetadata.ocrConfidence" },
        lowConfidence: {
          $sum: {
            $cond: [{ $lt: ["$validationStatus.overallConfidence", 70] }, 1, 0],
          },
        },
      },
    },
  ]);

  const result = accuracy[0] || {};

  return {
    totalInvoices: result.totalInvoices || 0,
    needsReview: result.needsReview || 0,
    userCorrected: result.userCorrected || 0,
    avgConfidence: result.avgConfidence || 0,
    avgOcrConfidence: result.avgOcrConfidence || 0,
    lowConfidence: result.lowConfidence || 0,
    reviewRate: result.totalInvoices
      ? (result.needsReview / result.totalInvoices) * 100
      : 0,
    correctionRate: result.totalInvoices
      ? (result.userCorrected / result.totalInvoices) * 100
      : 0,
    accuracyRate: result.totalInvoices
      ? ((result.totalInvoices - result.userCorrected) / result.totalInvoices) *
        100
      : 0,
  };
}

module.exports = router;

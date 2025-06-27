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
const VendorMapping = require("../models/VendorMapping");

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
          // Add delay before cleanup to avoid EBUSY error
          setTimeout(() => {
            try {
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } catch (cleanupError) {
              console.error("Delayed cleanup error:", cleanupError);
            }
          }, 1000);
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
          setTimeout(() => {
            try {
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } catch (cleanupError) {
              console.error("Cleanup error:", cleanupError);
            }
          }, 1000);
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
 * Process a single invoice file - FIXED DATE HANDLING
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
  const parsedData = await parseInvoiceData(
    extraction.text,
    extraction.metadata
  );

  console.log("Parsed data from LLM:", {
    vendor: parsedData.vendor,
    date: parsedData.date,
    dateType: typeof parsedData.date,
    isValidDate:
      parsedData.date instanceof Date && !isNaN(parsedData.date.getTime()),
    amount: parsedData.amount,
  });

  // FIXED: Ensure date is a valid Date object
  let validDate = parsedData.date;
  if (!(validDate instanceof Date) || isNaN(validDate.getTime())) {
    console.warn("Invalid date detected, using current date");
    validDate = new Date();
  }

  // Step 4: Extract additional metadata
  const additionalMetadata = extractMetadata(extraction.text);

  // Step 5: Validate parsed data - Pass the corrected date
  const dataToValidate = {
    ...parsedData,
    date: validDate,
  };

  const validation = await validateInvoiceData(dataToValidate, {
    ocrConfidence: extraction.confidence,
    fileType,
    pageCount: extraction.pageCount,
  });

  // Step 6: Check for potential duplicates - FIXED: Use valid date
  let potentialDuplicates = [];
  try {
    potentialDuplicates = await Invoice.findPotentialDuplicates(
      parsedData.vendor,
      parsedData.amount,
      validDate // Use the validated date
    );
  } catch (duplicateError) {
    console.error("Error checking duplicates:", duplicateError);
    // Continue without duplicate checking
  }

  // Step 7: Predict category
  const categoryPrediction = await predictCategory(
    parsedData.vendor,
    parsedData.amount
  );

  // Step 8: Create invoice record - FIXED: Use valid date
  const invoice = new Invoice({
    vendor: parsedData.vendor,
    date: validDate, // Use the validated date
    amount: parsedData.amount,
    category: categoryPrediction ? categoryPrediction.category : "5140",
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

  // Step 9: Update learning system
  if (
    categoryPrediction &&
    categoryPrediction.confidence >= 50 &&
    !invoice.isDuplicate
  ) {
    try {
      await VendorMapping.updateMapping(
        parsedData.vendor,
        categoryPrediction.category,
        parsedData.amount,
        false
      );
    } catch (error) {
      console.error("Failed to update learning system:", error);
    }
  }

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
 * Enhanced category prediction using learning system - REMOVED ALL AMOUNT RESTRICTIONS
 */
async function predictCategory(vendor, amount) {
  try {
    // First check learning system
    const learnedPrediction = await VendorMapping.predictCategory(
      vendor,
      amount
    );

    if (learnedPrediction && learnedPrediction.confidence >= 40) {
      // Lowered threshold
      console.log(
        `Learned prediction for ${vendor}: ${learnedPrediction.category} (${learnedPrediction.confidence}%)`
      );

      // Get category details
      const { defaultCategories } = require("./categories");
      const category = defaultCategories.find(
        (c) => c.code === learnedPrediction.category
      );

      return {
        category: learnedPrediction.category,
        name: category ? category.name : "Unknown Category",
        confidence: learnedPrediction.confidence,
        reason: learnedPrediction.reason,
        alternatives: learnedPrediction.alternatives,
      };
    }

    // No learned mapping - use enhanced rule-based prediction
    console.log(
      `No learned mapping for ${vendor}, using rule-based prediction`
    );

    const vendorLower = vendor.toLowerCase();

    // Enhanced rule-based predictions - REMOVED all amount restrictions
    const predictions = {
      // High confidence software/subscriptions
      midjourney: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      openai: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      anthropic: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      chatgpt: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      claude: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      adobe: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 90,
      },
      microsoft: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 90,
      },
      slack: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 90,
      },
      zoom: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 90,
      },
      dropbox: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },
      github: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },
      notion: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },
      figma: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },
      netlify: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },
      vercel: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 85,
      },

      // Cloud Services
      aws: {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      "amazon web services": {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      "google cloud": {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },
      "microsoft azure": {
        category: "5020",
        name: "Software Subscriptions",
        confidence: 95,
      },

      // Transportation - No amount limits
      uber: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },
      lyft: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },
      taxi: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 90,
      },

      // Airlines
      united: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },
      delta: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },
      "american airlines": {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },
      southwest: {
        category: "5040",
        name: "Travel & Transportation",
        confidence: 95,
      },

      // Food & Entertainment - No amount limits
      starbucks: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      "dunkin donuts": {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      mcdonald: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      "burger king": {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      subway: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      chipotle: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      "taco bell": {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      kfc: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 90,
      },
      restaurant: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 80,
      },
      cafe: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 80,
      },
      bistro: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 80,
      },
      doordash: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 85,
      },
      grubhub: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 85,
      },
      ubereats: {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 85,
      },

      // Retail/Office - More generous confidence
      amazon: {
        category: "5010",
        name: "Office Supplies",
        confidence: 70,
      },
      walmart: {
        category: "5010",
        name: "Office Supplies",
        confidence: 70,
      },
      target: {
        category: "5010",
        name: "Office Supplies",
        confidence: 70,
      },
      costco: {
        category: "5010",
        name: "Office Supplies",
        confidence: 70,
      },
      "office depot": {
        category: "5010",
        name: "Office Supplies",
        confidence: 90,
      },
      staples: {
        category: "5010",
        name: "Office Supplies",
        confidence: 90,
      },
      "best buy": {
        category: "5100",
        name: "Equipment & Technology",
        confidence: 85,
      },
      "home depot": {
        category: "5110",
        name: "Maintenance & Repairs",
        confidence: 85,
      },

      // Professional Services
      lawyer: {
        category: "5060",
        name: "Professional Services",
        confidence: 95,
      },
      attorney: {
        category: "5060",
        name: "Professional Services",
        confidence: 95,
      },
      accountant: {
        category: "5060",
        name: "Professional Services",
        confidence: 95,
      },
      consultant: {
        category: "5060",
        name: "Professional Services",
        confidence: 85,
      },
      freelancer: {
        category: "5060",
        name: "Professional Services",
        confidence: 80,
      },

      // Utilities & Communications
      verizon: {
        category: "5030",
        name: "Internet & Phone",
        confidence: 95,
      },
      "at&t": {
        category: "5030",
        name: "Internet & Phone",
        confidence: 95,
      },
      comcast: {
        category: "5030",
        name: "Internet & Phone",
        confidence: 95,
      },
      "t-mobile": {
        category: "5030",
        name: "Internet & Phone",
        confidence: 95,
      },
      sprint: {
        category: "5030",
        name: "Internet & Phone",
        confidence: 90,
      },

      // Marketing & Advertising
      "google ads": {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 95,
      },
      "facebook ads": {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 95,
      },
      "linkedin ads": {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 95,
      },
      facebook: {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 80,
      },
      instagram: {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 80,
      },
      linkedin: {
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 80,
      },

      // Education & Training
      udemy: {
        category: "5120",
        name: "Training & Education",
        confidence: 95,
      },
      coursera: {
        category: "5120",
        name: "Training & Education",
        confidence: 95,
      },
      pluralsight: {
        category: "5120",
        name: "Training & Education",
        confidence: 95,
      },
      "linkedin learning": {
        category: "5120",
        name: "Training & Education",
        confidence: 95,
      },

      // Insurance
      insurance: {
        category: "5090",
        name: "Insurance",
        confidence: 85,
      },

      // Banking
      "bank fee": {
        category: "5130",
        name: "Bank Fees",
        confidence: 90,
      },
    };

    // Check for exact or partial matches
    for (const [vendor_key, prediction] of Object.entries(predictions)) {
      if (vendorLower.includes(vendor_key)) {
        return {
          ...prediction,
          reason: `Matched vendor pattern: ${vendor_key}`,
          alternatives: getAlternativeCategories(prediction.category, 2),
        };
      }
    }

    // Enhanced pattern matching for broader coverage
    const patterns = [
      {
        pattern:
          /\b(restaurant|bistro|cafe|diner|eatery|grill|kitchen|bar|food)\b/i,
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 75,
      },
      {
        pattern: /\b(hotel|motel|inn|resort|lodging|accommodation)\b/i,
        category: "5040",
        name: "Travel & Transportation",
        confidence: 85,
      },
      {
        pattern: /\b(gas|fuel|petrol|shell|exxon|bp|chevron|station)\b/i,
        category: "5040",
        name: "Travel & Transportation",
        confidence: 85,
      },
      {
        pattern: /\b(parking|toll|airport)\b/i,
        category: "5040",
        name: "Travel & Transportation",
        confidence: 80,
      },
      {
        pattern: /\b(insurance|coverage|policy|premium)\b/i,
        category: "5090",
        name: "Insurance",
        confidence: 85,
      },
      {
        pattern: /\b(training|course|education|learning|workshop|seminar)\b/i,
        category: "5120",
        name: "Training & Education",
        confidence: 85,
      },
      {
        pattern: /\b(bank|fee|charge|finance|loan|credit)\b/i,
        category: "5130",
        name: "Bank Fees",
        confidence: 75,
      },
      {
        pattern: /\b(electric|gas|water|utility|power|energy)\b/i,
        category: "5080",
        name: "Rent & Utilities",
        confidence: 85,
      },
      {
        pattern: /\b(software|app|saas|subscription|service)\b/i,
        category: "5020",
        name: "Software Subscriptions",
        confidence: 70,
      },
      {
        pattern: /\b(computer|laptop|server|hardware|tech)\b/i,
        category: "5100",
        name: "Equipment & Technology",
        confidence: 75,
      },
      {
        pattern: /\b(repair|maintenance|fix|service)\b/i,
        category: "5110",
        name: "Maintenance & Repairs",
        confidence: 70,
      },
      {
        pattern: /\b(marketing|advertising|promotion|ad)\b/i,
        category: "5070",
        name: "Marketing & Advertising",
        confidence: 75,
      },
      {
        pattern: /\b(llc|inc|corp|ltd|company|co\.)\b/i,
        category: "5060",
        name: "Professional Services",
        confidence: 60,
      },
      {
        pattern: /\b(store|shop|market|retail|supply)\b/i,
        category: "5010",
        name: "Office Supplies",
        confidence: 55,
      },
    ];

    for (const { pattern, category, name, confidence } of patterns) {
      if (pattern.test(vendorLower)) {
        return {
          category,
          name,
          confidence,
          reason: `Matched business pattern in vendor name`,
          alternatives: getAlternativeCategories(category, 2),
        };
      }
    }

    // Default fallback without amount-based restrictions
    return {
      category: "5140",
      name: "Miscellaneous Expenses",
      confidence: 30,
      reason: "Unknown vendor type - please verify category",
      alternatives: [
        { category: "5010", name: "Office Supplies", confidence: 35 },
        { category: "5050", name: "Meals & Entertainment", confidence: 35 },
        { category: "5060", name: "Professional Services", confidence: 30 },
        { category: "5020", name: "Software Subscriptions", confidence: 30 },
      ],
    };
  } catch (error) {
    console.error("Category prediction error:", error);
    return {
      category: "5140",
      name: "Miscellaneous Expenses",
      confidence: 20,
      reason: "Prediction error - please select category manually",
    };
  }
}

/**
 * Helper function for alternative categories
 */
function getAlternativeCategories(excludeCode, count = 2) {
  const { defaultCategories } = require("./categories");
  const expenseCategories = defaultCategories
    .filter((c) => c.code.startsWith("5") && c.code !== excludeCode)
    .slice(0, count);

  return expenseCategories.map((c) => ({
    category: c.code,
    name: c.name,
    confidence: Math.floor(Math.random() * 15) + 25, // 25-40% confidence
  }));
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

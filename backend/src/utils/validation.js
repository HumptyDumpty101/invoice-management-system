const Joi = require("joi");

/**
 * Enhanced validation system for parsed invoice data
 * @param {Object} data - Parsed invoice data
 * @param {Object} fileMetadata - File extraction metadata
 * @returns {Object} - Validation results
 */
async function validateInvoiceData(data, fileMetadata = {}) {
  const issues = [];
  let overallConfidence = 100;

  // Validate individual fields - CHANGED: Only warnings, no blocking
  const dateValidation = validateDate(data.date);
  const amountValidation = validateAmount(data.amount);
  const vendorValidation = validateVendor(data.vendor);
  const lineItemsValidation = validateLineItems(data.lineItems, data.amount);

  // Date validation - CHANGED: Convert errors to warnings
  if (!dateValidation.valid) {
    issues.push(`Date warning: ${dateValidation.error}`);
    overallConfidence -= 15; // Reduced penalty
  }

  // Amount validation - CHANGED: Convert errors to warnings
  if (!amountValidation.valid) {
    issues.push(`Amount warning: ${amountValidation.error}`);
    overallConfidence -= 20; // Reduced penalty
  }

  // Vendor validation - CHANGED: Convert errors to warnings
  if (!vendorValidation.valid) {
    issues.push(`Vendor warning: ${vendorValidation.error}`);
    overallConfidence -= 10; // Reduced penalty
  }

  // Line items validation - CHANGED: Only warnings
  if (!lineItemsValidation.valid) {
    issues.push(
      ...lineItemsValidation.errors.map((err) => `Line items warning: ${err}`)
    );
    overallConfidence -= Math.min(lineItemsValidation.penalty, 15); // Cap penalty
  }

  // File quality adjustments
  if (fileMetadata.ocrConfidence && fileMetadata.ocrConfidence < 70) {
    issues.push("Low OCR confidence - please verify extracted data");
    overallConfidence -= 10; // Reduced penalty
  }

  if (fileMetadata.pageCount && fileMetadata.pageCount > 1) {
    issues.push("Multi-page document - verify all line items captured");
    overallConfidence -= 3; // Reduced penalty
  }

  // Cross-field validation - CHANGED: Only warnings
  const crossValidation = validateCrossFields(data);
  if (crossValidation.issues.length > 0) {
    issues.push(
      ...crossValidation.issues.map((issue) => `Validation notice: ${issue}`)
    );
    overallConfidence -= Math.min(crossValidation.penalty, 10); // Cap penalty
  }

  // Business logic validations - CHANGED: Only confidence penalties
  const businessValidation = validateBusinessLogic(data);
  if (businessValidation.issues.length > 0) {
    issues.push(
      ...businessValidation.issues.map(
        (issue) => `Business logic notice: ${issue}`
      )
    );
    overallConfidence -= Math.min(businessValidation.penalty, 10); // Cap penalty
  }

  return {
    isValid: true, // CHANGED: Always return true - never block edits
    dateValid: dateValidation.valid,
    amountValid: amountValidation.valid,
    vendorValid: vendorValidation.valid,
    lineItemsValid: lineItemsValidation.valid,
    overallConfidence: Math.max(20, overallConfidence), // Minimum 20% confidence
    issues,
    needsReview: overallConfidence < 80 || issues.length > 3, // Adjusted threshold
  };
}

/**
 * Enhanced line items validation
 */
function validateLineItems(lineItems, totalAmount) {
  const errors = [];
  let penalty = 0;

  if (!Array.isArray(lineItems)) {
    return {
      valid: false,
      errors: ["Line items must be an array"],
      penalty: 10,
    };
  }

  // Check for reasonable number of line items
  if (lineItems.length > 50) {
    errors.push("Unusually high number of line items - possible parsing error");
    penalty += 15;
  }

  // Validate individual line items
  let totalLineItemAmount = 0;
  let invalidItemCount = 0;

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];

    // Check required fields
    if (!item.description || item.description.trim().length === 0) {
      invalidItemCount++;
      continue;
    }

    if (typeof item.amount !== "number" || item.amount <= 0) {
      invalidItemCount++;
      continue;
    }

    // Check for reasonable amounts
    if (item.amount > 10000) {
      errors.push(
        `Line item ${i + 1} has unusually high amount: $${item.amount}`
      );
      penalty += 2;
    }

    // Check quantity
    const quantity = item.quantity || 1;
    if (quantity < 1 || quantity > 1000) {
      errors.push(`Line item ${i + 1} has invalid quantity: ${quantity}`);
      penalty += 2;
    }

    totalLineItemAmount += item.amount * quantity;

    // Check for duplicate descriptions
    const duplicates = lineItems.filter(
      (other) =>
        other !== item &&
        other.description &&
        other.description.toLowerCase() === item.description.toLowerCase()
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate line item found: "${item.description}"`);
      penalty += 3;
    }
  }

  // Check invalid item ratio
  if (lineItems.length > 0) {
    const invalidRatio = invalidItemCount / lineItems.length;
    if (invalidRatio > 0.3) {
      errors.push("High number of invalid line items detected");
      penalty += 10;
    }
  }

  // Compare line items total with invoice total
  if (lineItems.length > 0 && totalAmount > 0) {
    const difference = Math.abs(totalLineItemAmount - totalAmount);
    const percentDiff = (difference / totalAmount) * 100;

    if (percentDiff > 5) {
      // More than 5% difference
      errors.push(
        `Line items total ($${totalLineItemAmount.toFixed(
          2
        )}) doesn't match invoice total ($${totalAmount.toFixed(2)})`
      );
      penalty += 8;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    penalty,
    totalLineItemAmount,
    invalidItemCount,
  };
}

/**
 * Enhanced business logic validation
 */
function validateBusinessLogic(data) {
  const issues = [];
  let penalty = 0;

  // Vendor-specific validations - CHANGED: Only warnings
  if (data.vendor) {
    const vendor = data.vendor.toLowerCase();

    // Check for subscription services with monthly amounts
    const subscriptionServices = [
      "midjourney",
      "netflix",
      "spotify",
      "adobe",
      "microsoft",
      "zoom",
      "slack",
    ];
    const isSubscription = subscriptionServices.some((service) =>
      vendor.includes(service)
    );

    if (isSubscription && data.amount > 1000) {
      issues.push("High amount for subscription service - please verify");
      penalty += 3; // Reduced from 5
    }

    // Check for restaurant/food with very high amounts - CHANGED: Much more lenient
    const foodKeywords = [
      "restaurant",
      "cafe",
      "bistro",
      "starbucks",
      "mcdonald",
      "food",
      "dining",
    ];
    const isFood = foodKeywords.some((keyword) => vendor.includes(keyword));

    if (isFood && data.amount > 1000) {
      // CHANGED: Increased threshold from 500 to 1000
      issues.push(
        "High amount for food/restaurant - please verify this is correct"
      );
      penalty += 2; // Reduced from 3
    }

    // REMOVED: Uber high amount check - too restrictive for business travel
  }

  // Date logic validations - CHANGED: More lenient
  if (data.date) {
    const now = new Date();
    const invoiceDate = new Date(data.date);

    // Check if invoice is from future - CHANGED: More lenient
    if (invoiceDate > now) {
      const daysDiff = Math.ceil((invoiceDate - now) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        // CHANGED: Increased from 30 to 90 days
        issues.push("Invoice date is far in the future - please verify");
        penalty += 5; // Reduced from 10
      }
    }

    // Check if invoice is very old - CHANGED: More lenient
    const twoYearsAgo = new Date(
      now.getFullYear() - 2,
      now.getMonth(),
      now.getDate()
    );
    if (invoiceDate < twoYearsAgo) {
      issues.push("Invoice is over 2 years old - please verify date");
      penalty += 3; // Reduced from 5
    }
  }

  // Amount reasonableness checks - CHANGED: Much more lenient
  if (data.amount) {
    // REMOVED: Round number penalty - not useful

    // Check for very small amounts
    if (data.amount < 0.01) {
      issues.push("Amount is extremely small - possible parsing error");
      penalty += 8; // Reduced from 15
    }

    // Check for very large amounts - CHANGED: Much higher threshold
    if (data.amount > 1000000) {
      // CHANGED: Increased from 100,000 to 1,000,000
      issues.push("Amount is extremely large - please verify");
      penalty += 5; // Reduced from 10
    }
  }

  // Line items business logic - CHANGED: More lenient
  if (data.lineItems && data.lineItems.length > 0) {
    // Check for items with zero or negative amounts
    const invalidAmountItems = data.lineItems.filter(
      (item) => item.amount <= 0
    );
    if (invalidAmountItems.length > 0) {
      issues.push(
        `${invalidAmountItems.length} line items have invalid amounts`
      );
      penalty += 3; // Reduced from 5
    }

    // Check for extremely long descriptions - CHANGED: Higher threshold
    const longDescriptions = data.lineItems.filter(
      (item) => item.description && item.description.length > 500 // CHANGED: Increased from 200 to 500
    );
    if (longDescriptions.length > 0) {
      issues.push("Some line item descriptions are unusually long");
      penalty += 2; // Reduced from 3
    }

    // MODIFIED: More lenient header detection
    const suspiciousItems = data.lineItems.filter((item) => {
      const desc = item.description?.toLowerCase() || "";
      return /^(total|subtotal|tax|amount due|balance due)$/i.test(desc); // More specific patterns
    });
    if (suspiciousItems.length > 0) {
      issues.push("Some line items appear to be totals rather than items");
      penalty += 3; // Reduced from 8
    }
  }

  return { issues, penalty };
}

/**
 * Validate date field with enhanced checks
 */
function validateDate(date) {
  if (!date) {
    return { valid: false, error: "Date is required" };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  // CHANGED: Much more lenient date range
  const now = new Date();
  const fiveYearsAgo = new Date(
    now.getFullYear() - 5, // CHANGED: Increased from 2 to 5 years
    now.getMonth(),
    now.getDate()
  );
  const twoYearsFromNow = new Date( // CHANGED: Increased from 1 to 2 years
    now.getFullYear() + 2,
    now.getMonth(),
    now.getDate()
  );

  if (dateObj < fiveYearsAgo) {
    return {
      valid: false,
      error: "Date seems too far in the past (over 5 years)",
    };
  }

  if (dateObj > twoYearsFromNow) {
    return {
      valid: false,
      error: "Date is too far in the future (over 2 years)",
    };
  }

  return { valid: true };
}
/**
 * Validate amount field with enhanced checks
 */
function validateAmount(amount) {
  if (amount === undefined || amount === null) {
    return { valid: false, error: "Amount is required" };
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return { valid: false, error: "Amount must be a valid number" };
  }

  if (numAmount <= 0) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  // CHANGED: Much higher threshold
  if (numAmount > 10000000) {
    // CHANGED: Increased from 1,000,000 to 10,000,000
    return {
      valid: false,
      error: "Amount seems unusually large (over $10M) - please verify",
    };
  }

  // Check for reasonable decimal places
  const decimalPlaces = (numAmount.toString().split(".")[1] || "").length;
  if (decimalPlaces > 4) {
    // CHANGED: Increased from 2 to 4 decimal places
    return {
      valid: false,
      error: "Amount should have at most 4 decimal places",
    };
  }

  return { valid: true };
}

/**
 * Validate vendor field with enhanced checks
 */
function validateVendor(vendor) {
  if (!vendor || typeof vendor !== "string") {
    return { valid: false, error: "Vendor name is required" };
  }

  const trimmedVendor = vendor.trim();

  if (trimmedVendor.length < 2) {
    return { valid: false, error: "Vendor name is too short" };
  }

  if (trimmedVendor.length > 100) {
    return { valid: false, error: "Vendor name is too long" };
  }

  if (trimmedVendor.toLowerCase() === "unknown vendor") {
    return { valid: false, error: "Could not identify vendor name" };
  }

  // Check for suspicious patterns that might indicate parsing errors
  const suspiciousPatterns = [
    /^\d+$/, // Only numbers
    /^[^a-zA-Z]*$/, // No letters
    /(.)\1{4,}/, // Repeated characters (5+ times)
    /^(page|total|amount|date|invoice|receipt)$/i, // Common header words
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedVendor)) {
      return {
        valid: false,
        error: "Vendor name appears to be corrupted or misidentified",
      };
    }
  }

  return { valid: true };
}

/**
 * Validate relationships between fields with enhanced logic
 */
function validateCrossFields(data) {
  const issues = [];
  let penalty = 0;

  // Validate tax calculation if present
  if (data.tax > 0 && data.subtotal > 0) {
    const calculatedTotal = data.subtotal + data.tax;
    const difference = Math.abs(calculatedTotal - data.amount);

    if (difference > 0.02) {
      // Allow for small rounding errors
      issues.push(
        `Total amount (${
          data.amount
        }) does not match subtotal + tax (${calculatedTotal.toFixed(2)})`
      );
      penalty += 10;
    }

    // Check tax rate reasonableness (0% to 50% - allowing for high tax jurisdictions)
    const taxRate = (data.tax / data.subtotal) * 100;
    if (taxRate > 50) {
      issues.push(`Tax rate appears unusually high (${taxRate.toFixed(1)}%)`);
      penalty += 8;
    } else if (taxRate < 0.1) {
      issues.push(`Tax rate appears unusually low (${taxRate.toFixed(1)}%)`);
      penalty += 3;
    }
  }

  // Validate line items sum if present
  if (data.lineItems && data.lineItems.length > 0) {
    const lineItemsTotal = data.lineItems.reduce((sum, item) => {
      return sum + item.amount * (item.quantity || 1);
    }, 0);

    // Compare with subtotal if available, otherwise with total amount
    const expectedTotal =
      data.subtotal > 0 ? data.subtotal : data.amount - (data.tax || 0);
    const difference = Math.abs(lineItemsTotal - expectedTotal);
    const percentDiff =
      expectedTotal > 0 ? (difference / expectedTotal) * 100 : 0;

    if (percentDiff > 5) {
      // More than 5% difference
      issues.push(
        `Line items total (${lineItemsTotal.toFixed(
          2
        )}) does not match expected amount (${expectedTotal.toFixed(2)})`
      );
      penalty += 10;
    }
  }

  // Validate amount relationships
  if (data.subtotal > 0 && data.amount > 0) {
    if (data.subtotal > data.amount) {
      issues.push("Subtotal is greater than total amount");
      penalty += 15;
    }
  }

  if (data.tax > 0 && data.amount > 0) {
    if (data.tax > data.amount) {
      issues.push("Tax is greater than total amount");
      penalty += 15;
    }
  }

  // Validate vendor-amount relationship
  if (data.vendor && data.amount) {
    const vendor = data.vendor.toLowerCase();

    // Known vendor amount validations
    if (vendor.includes("starbucks") && data.amount > 100) {
      issues.push("Amount seems high for Starbucks purchase");
      penalty += 3;
    }

    if (vendor.includes("uber") && data.amount > 200) {
      issues.push("Amount seems high for Uber ride");
      penalty += 3;
    }
  }

  return { issues, penalty };
}

/**
 * Enhanced invoice update validation
 */
function validateInvoiceUpdate(data) {
  // CHANGED: Much more lenient Joi schema
  const invoiceUpdateSchema = Joi.object({
    vendor: Joi.string()
      .trim()
      .min(1) // CHANGED: Reduced from 2 to 1
      .max(200) // CHANGED: Increased from 100 to 200
      .required()
      .messages({
        "string.min": "Vendor name must be at least 1 character",
        "string.max": "Vendor name cannot exceed 200 characters",
      }),

    date: Joi.date()
      .min("1-1-2019") // CHANGED: More lenient - back to 2019
      .max("12-31-2030") // CHANGED: More lenient - up to 2030
      .required()
      .messages({
        "date.min": "Date cannot be before January 1, 2019",
        "date.max": "Date cannot be after December 31, 2030",
      }),

    amount: Joi.number()
      .positive()
      .max(10000000) // CHANGED: Increased from 1,000,000 to 10,000,000
      .precision(4) // CHANGED: Increased from 2 to 4 decimal places
      .required()
      .messages({
        "number.positive": "Amount must be greater than 0",
        "number.max": "Amount cannot exceed $10,000,000",
        "number.precision": "Amount can have at most 4 decimal places",
      }),

    category: Joi.string()
      .pattern(/^\d{4}$/)
      .required()
      .messages({
        "string.pattern.base": "Category must be a 4-digit code",
      }),

    extractedData: Joi.object({
      lineItems: Joi.array()
        .items(
          Joi.object({
            description: Joi.string().max(1000).required(), // CHANGED: Increased from 200 to 1000
            amount: Joi.number()
              .positive()
              .max(10000000)
              .precision(4)
              .required(), // CHANGED: More lenient
            quantity: Joi.number().integer().positive().max(100000).default(1), // CHANGED: Increased limit
          })
        )
        .max(1000), // CHANGED: Increased from 100 to 1000

      tax: Joi.number().min(0).max(10000000).precision(4).default(0), // CHANGED: More lenient
      subtotal: Joi.number().positive().max(10000000).precision(4).optional(), // CHANGED: More lenient
      currency: Joi.string().length(3).default("USD"),
    }).optional(),
  });

  const { error, value } = invoiceUpdateSchema.validate(data, {
    allowUnknown: true,
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    return {
      valid: false,
      error: error.details[0].message,
      details: error.details,
    };
  }

  // CHANGED: Remove business logic blocking - just add warnings
  const businessValidation = validateBusinessLogic(value);
  if (businessValidation.issues.length > 0) {
    // Don't block, just note the issues
    console.log("Business validation warnings:", businessValidation.issues);
  }

  return {
    valid: true,
    data: value,
    warnings: businessValidation.issues, // ADDED: Include warnings but don't block
  };
}

/**
 * Validate category code format
 */
function validateCategoryCode(code) {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Category code is required" };
  }

  // Category codes should be 4-digit numbers
  if (!/^\d{4}$/.test(code)) {
    return { valid: false, error: "Category code must be a 4-digit number" };
  }

  const numCode = parseInt(code);

  // Valid ranges for chart of accounts
  const validRanges = [
    [1000, 1999], // Assets
    [2000, 2999], // Liabilities
    [3000, 3999], // Equity
    [4000, 4999], // Revenue
    [5000, 6999], // Expenses
  ];

  const isValid = validRanges.some(
    ([min, max]) => numCode >= min && numCode <= max
  );

  if (!isValid) {
    return { valid: false, error: "Invalid category code range" };
  }

  return { valid: true };
}

/**
 * Sanitize text input with enhanced cleaning
 */
function sanitizeText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[^\w\s$.,/:\-()[\]@&]/g, "") // Keep only safe characters
    .substring(0, 1000); // Limit length
}

/**
 * Advanced validation for specific invoice types
 */
function validateInvoiceType(data, invoiceType = "general") {
  const issues = [];
  let penalty = 0;

  switch (invoiceType) {
    case "subscription":
      if (
        !data.vendor ||
        !/(subscription|plan|monthly|annual)/i.test(data.vendor)
      ) {
        issues.push("Vendor name doesn't indicate subscription service");
        penalty += 5;
      }

      if (data.lineItems && data.lineItems.length > 3) {
        issues.push("Subscription invoices typically have few line items");
        penalty += 3;
      }
      break;

    case "restaurant":
      if (data.lineItems && data.lineItems.length === 0) {
        issues.push("Restaurant invoices typically have multiple line items");
        penalty += 8;
      }

      if (data.tax === 0 && data.amount > 20) {
        issues.push("Restaurant invoices typically include tax");
        penalty += 5;
      }
      break;

    case "retail":
      if (data.amount > 10000) {
        issues.push("Unusually high amount for retail purchase");
        penalty += 5;
      }
      break;

    case "service":
      if (data.lineItems && data.lineItems.length > 10) {
        issues.push("Service invoices typically have fewer line items");
        penalty += 3;
      }
      break;
  }

  return { issues, penalty };
}

module.exports = {
  validateInvoiceData,
  validateInvoiceUpdate,
  validateCategoryCode,
  validateLineItems,
  validateBusinessLogic,
  validateCrossFields,
  validateInvoiceType,
  sanitizeText,
};

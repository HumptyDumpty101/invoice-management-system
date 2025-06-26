const Joi = require("joi");

/**
 * Validate parsed invoice data
 * @param {Object} data - Parsed invoice data
 * @param {Object} fileMetadata - File extraction metadata
 * @returns {Object} - Validation results
 */
async function validateInvoiceData(data, fileMetadata = {}) {
  const issues = [];
  let overallConfidence = 100;

  // Validate individual fields
  const dateValidation = validateDate(data.date);
  const amountValidation = validateAmount(data.amount);
  const vendorValidation = validateVendor(data.vendor);

  // Date validation
  if (!dateValidation.valid) {
    issues.push(dateValidation.error);
    overallConfidence -= 20;
  }

  // Amount validation
  if (!amountValidation.valid) {
    issues.push(amountValidation.error);
    overallConfidence -= 30;
  }

  // Vendor validation
  if (!vendorValidation.valid) {
    issues.push(vendorValidation.error);
    overallConfidence -= 15;
  }

  // File quality adjustments
  if (fileMetadata.ocrConfidence && fileMetadata.ocrConfidence < 70) {
    issues.push("Low OCR confidence - please verify extracted data");
    overallConfidence -= 15;
  }

  if (fileMetadata.pageCount && fileMetadata.pageCount > 1) {
    issues.push("Multi-page document - verify all line items captured");
    overallConfidence -= 5;
  }

  // Cross-field validation
  const crossValidation = validateCrossFields(data);
  if (crossValidation.issues.length > 0) {
    issues.push(...crossValidation.issues);
    overallConfidence -= crossValidation.penalty;
  }

  return {
    isValid: issues.length === 0,
    dateValid: dateValidation.valid,
    amountValid: amountValidation.valid,
    vendorValid: vendorValidation.valid,
    overallConfidence: Math.max(0, overallConfidence),
    issues,
    needsReview: overallConfidence < 80 || issues.length > 2,
  };
}

/**
 * Validate date field
 */
function validateDate(date) {
  if (!date) {
    return { valid: false, error: "Date is required" };
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  // Check if date is reasonable (not too far in future or past)
  const now = new Date();
  const twoYearsAgo = new Date(
    now.getFullYear() - 2,
    now.getMonth(),
    now.getDate()
  );
  const oneYearFromNow = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate()
  );

  if (dateObj < twoYearsAgo) {
    return { valid: false, error: "Date seems too far in the past" };
  }

  if (dateObj > oneYearFromNow) {
    return { valid: false, error: "Date is in the future" };
  }

  return { valid: true };
}

/**
 * Validate amount field
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

  if (numAmount > 100000) {
    return {
      valid: false,
      error: "Amount seems unusually large - please verify",
    };
  }

  // Check for reasonable decimal places
  const decimalPlaces = (numAmount.toString().split(".")[1] || "").length;
  if (decimalPlaces > 2) {
    return {
      valid: false,
      error: "Amount should have at most 2 decimal places",
    };
  }

  return { valid: true };
}

/**
 * Validate vendor field
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

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^\d+$/, // Only numbers
    /^[^a-zA-Z]*$/, // No letters
    /(.)\1{4,}/, // Repeated characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedVendor)) {
      return { valid: false, error: "Vendor name appears to be corrupted" };
    }
  }

  return { valid: true };
}

/**
 * Validate relationships between fields
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
      issues.push("Total amount does not match subtotal + tax");
      penalty += 10;
    }

    // Check tax rate reasonableness (0% to 15%)
    const taxRate = (data.tax / data.subtotal) * 100;
    if (taxRate > 15) {
      issues.push("Tax rate appears unusually high");
      penalty += 5;
    }
  }

  // Validate line items sum if present
  if (data.lineItems && data.lineItems.length > 0) {
    const lineItemsTotal = data.lineItems.reduce((sum, item) => {
      return sum + item.amount * (item.quantity || 1);
    }, 0);

    const expectedSubtotal = data.subtotal || data.amount - (data.tax || 0);
    const difference = Math.abs(lineItemsTotal - expectedSubtotal);

    if (difference > 0.02) {
      issues.push("Line items total does not match subtotal");
      penalty += 5;
    }
  }

  return { issues, penalty };
}

/**
 * Joi schema for invoice validation (for API endpoints)
 */
const invoiceSchema = Joi.object({
  vendor: Joi.string().trim().min(2).max(100).required(),
  date: Joi.date().min("1-1-2020").max("12-31-2025").required(),
  amount: Joi.number().positive().max(100000).precision(2).required(),
  category: Joi.string().required(),
  extractedData: Joi.object({
    lineItems: Joi.array().items(
      Joi.object({
        description: Joi.string().max(200),
        amount: Joi.number().positive(),
        quantity: Joi.number().positive().integer(),
      })
    ),
    tax: Joi.number().min(0),
    subtotal: Joi.number().positive(),
    currency: Joi.string().length(3).default("USD"),
  }).optional(),
});

/**
 * Validate invoice update data
 */
function validateInvoiceUpdate(data) {
  const { error, value } = invoiceSchema.validate(data, {
    allowUnknown: true,
    stripUnknown: true,
  });

  if (error) {
    return {
      valid: false,
      error: error.details[0].message,
      details: error.details,
    };
  }

  return {
    valid: true,
    data: value,
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
 * Sanitize text input
 */
function sanitizeText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .substring(0, 1000); // Limit length
}

module.exports = {
  validateInvoiceData,
  validateInvoiceUpdate,
  validateCategoryCode,
  sanitizeText,
  invoiceSchema,
};

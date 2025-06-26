/**
 * Parse extracted text to structured invoice data
 * @param {string} text - Raw extracted text
 * @param {Object} metadata - Extraction metadata
 * @returns {Object} - Structured invoice data
 */
function parseInvoiceData(text, metadata = {}) {
  const result = {
    vendor: extractVendor(text),
    date: extractDate(text),
    amount: extractAmount(text),
    lineItems: extractLineItems(text),
    tax: extractTax(text),
    subtotal: extractSubtotal(text),
  };

  // Add parsing confidence
  result.parsingConfidence = calculateParsingConfidence(result, text);

  return result;
}

/**
 * Extract vendor name from text
 */
function extractVendor(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  // Common vendor patterns
  const vendorPatterns = [
    // Known vendors
    /amazon\.com/i,
    /uber/i,
    /starbucks/i,
    /walmart/i,
    /target/i,
    /office depot/i,
    /best buy/i,
    /home depot/i,
    // Generic patterns - usually first line or has LLC, Inc, etc.
    /\b\w+\s+(llc|inc|corp|ltd|company)\b/i,
    /\b\w+\s+\w+\s+(store|shop|restaurant|bistro|cafe)\b/i,
  ];

  // Check first few lines for vendor name
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];

    // Skip common non-vendor patterns
    if (/^(receipt|invoice|order|date|total)/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // Skip numbers only
    if (line.length < 3) continue; // Skip very short lines

    // Check against known patterns
    for (const pattern of vendorPatterns) {
      if (pattern.test(line)) {
        return cleanVendorName(line);
      }
    }

    // If no pattern matches, use first substantial line
    if (i === 0 && line.length > 3) {
      return cleanVendorName(line);
    }
  }

  return "Unknown Vendor";
}

/**
 * Clean and normalize vendor name
 */
function cleanVendorName(vendor) {
  return vendor
    .replace(/[^a-zA-Z0-9\s&-]/g, "") // Remove special chars except &, -
    .replace(/\s+/g, " ") // Normalize spaces
    .trim()
    .substring(0, 50); // Limit length
}

/**
 * Extract date from text
 */
function extractDate(text) {
  const datePatterns = [
    // MM/DD/YYYY or MM/DD/YY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    // Month DD, YYYY
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // DD Month YYYY
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      return parseDate(match[0]);
    }
  }

  // If no date found, return current date as fallback
  return new Date();
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
  try {
    // Handle various date formats
    const date = new Date(dateStr);

    // Validate date
    if (isNaN(date.getTime())) {
      return new Date(); // Fallback to current date
    }

    // If year is 2-digit, assume 20XX
    if (date.getFullYear() < 1000) {
      date.setFullYear(2000 + (date.getFullYear() % 100));
    }

    return date;
  } catch (error) {
    return new Date(); // Fallback to current date
  }
}

/**
 * Extract total amount from text
 */
function extractAmount(text) {
  const amountPatterns = [
    // Total: $XX.XX or TOTAL $XX.XX
    /total:?\s*\$?(\d+(?:\.\d{2})?)/gi,
    // Amount: $XX.XX
    /amount:?\s*\$?(\d+(?:\.\d{2})?)/gi,
    // Just $XX.XX at end of line
    /\$(\d+\.\d{2})$/gm,
    // Generic money pattern
    /\$(\d+(?:\.\d{2})?)/g,
  ];

  const amounts = [];

  for (const pattern of amountPatterns) {
    const matches = [...text.matchAll(pattern)];
    matches.forEach((match) => {
      const amount = parseFloat(match[1]);
      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount);
      }
    });
  }

  if (amounts.length === 0) return 0;

  // Return the largest amount (likely the total)
  return Math.max(...amounts);
}

/**
 * Extract line items from text
 */
function extractLineItems(text) {
  const items = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Look for lines with item name and price
    const itemMatch = line.match(/^(.+?)\s+\$?(\d+(?:\.\d{2})?)$/);
    if (itemMatch) {
      const description = itemMatch[1].trim();
      const amount = parseFloat(itemMatch[2]);

      // Skip total/subtotal/tax lines
      if (!/^(total|subtotal|tax|tip|amount)/i.test(description)) {
        items.push({
          description,
          amount,
          quantity: 1, // Default quantity
        });
      }
    }
  }

  return items;
}

/**
 * Extract tax amount
 */
function extractTax(text) {
  const taxPattern = /tax:?\s*\$?(\d+(?:\.\d{2})?)/gi;
  const matches = [...text.matchAll(taxPattern)];

  if (matches.length > 0) {
    return parseFloat(matches[0][1]);
  }

  return 0;
}

/**
 * Extract subtotal amount
 */
function extractSubtotal(text) {
  const subtotalPattern = /subtotal:?\s*\$?(\d+(?:\.\d{2})?)/gi;
  const matches = [...text.matchAll(subtotalPattern)];

  if (matches.length > 0) {
    return parseFloat(matches[0][1]);
  }

  return 0;
}

/**
 * Calculate parsing confidence based on extracted data quality
 */
function calculateParsingConfidence(parsedData, originalText) {
  let confidence = 100;

  // Vendor confidence
  if (parsedData.vendor === "Unknown Vendor") {
    confidence -= 20;
  }

  // Amount confidence
  if (parsedData.amount === 0) {
    confidence -= 30;
  }

  // Date confidence - check if date is reasonable
  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate()
  );
  const oneYearFromNow = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate()
  );

  if (parsedData.date < oneYearAgo || parsedData.date > oneYearFromNow) {
    confidence -= 15;
  }

  // Line items confidence
  if (parsedData.lineItems.length === 0) {
    confidence -= 10;
  }

  // Tax/subtotal validation
  if (parsedData.tax > 0 && parsedData.subtotal > 0) {
    const calculatedTotal = parsedData.subtotal + parsedData.tax;
    const totalDiff = Math.abs(calculatedTotal - parsedData.amount);
    if (totalDiff > 0.01) {
      // Allow for rounding
      confidence -= 10;
    }
  }

  return Math.max(0, confidence);
}

/**
 * Normalize vendor name for learning system
 */
function normalizeVendor(vendor) {
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract additional metadata from text
 */
function extractMetadata(text) {
  return {
    hasReceiptNumber: /receipt\s*#?\s*\d+/i.test(text),
    hasOrderNumber: /order\s*#?\s*[\w\d-]+/i.test(text),
    hasServerInfo: /server|cashier|clerk/i.test(text),
    isRestaurant: /restaurant|bistro|cafe|diner|eatery/i.test(text),
    isGasStation: /gas|fuel|shell|exxon|bp|chevron/i.test(text),
    isOnlineOrder: /amazon|ebay|paypal|online/i.test(text),
    language: detectLanguage(text),
  };
}

/**
 * Simple language detection
 */
function detectLanguage(text) {
  // Very basic language detection
  const englishWords = ["the", "and", "total", "tax", "date", "amount"];
  const englishCount = englishWords.reduce((count, word) => {
    return count + (text.toLowerCase().includes(word) ? 1 : 0);
  }, 0);

  return englishCount >= 2 ? "en" : "unknown";
}

module.exports = {
  parseInvoiceData,
  normalizeVendor,
  extractMetadata,
  cleanVendorName,
};

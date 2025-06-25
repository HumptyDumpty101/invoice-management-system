const fs = require("fs");
const pdfParse = require("pdf-parse");

/**
 * Extract text from PDF or image files
 * @param {string} filePath - Path to the uploaded file
 * @param {string} fileType - Type of file (pdf, jpg, png, etc.)
 * @returns {Object} - Extracted text and metadata
 */
async function extractText(filePath, fileType) {
  try {
    if (fileType === "pdf") {
      return await extractFromPDF(filePath);
    } else if (["jpg", "jpeg", "png"].includes(fileType)) {
      return await extractFromImage(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error("Text extraction error:", error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from PDF files
 */
async function extractFromPDF(filePath) {
  const startTime = Date.now();
  const dataBuffer = fs.readFileSync(filePath);

  const data = await pdfParse(dataBuffer, {
    max: 0, // parse all pages
    version: "v1.10.100",
  });

  const processingTime = Date.now() - startTime;

  return {
    text: data.text,
    pageCount: data.numpages,
    extractionMethod: "pdf",
    processingTime,
    confidence: calculatePDFConfidence(data.text),
    metadata: {
      pages: data.numpages,
      info: data.info || {},
      version: data.version,
    },
  };
}

/**
 * Extract text from images using OCR
 * mock OCR response
 * TODO : replace with actual Tesseract.js implementation
 */
async function extractFromImage(filePath) {
  const startTime = Date.now();

  // Mock OCR for demo - in real implementation use Tesseract.js
  // const { createWorker } = require('tesseract.js');

  // For now, return mock data that looks like real OCR output
  const mockOCRResults = generateMockOCRResult(filePath);

  const processingTime = Date.now() - startTime;

  return {
    text: mockOCRResults.text,
    pageCount: 1,
    extractionMethod: "ocr",
    processingTime,
    confidence: mockOCRResults.confidence,
    metadata: {
      ocrEngine: "mock", // TODO: would be 'tesseract' in production
      language: "eng",
    },
  };
}

/**
 * Calculate confidence score for PDF extraction
 */
function calculatePDFConfidence(text) {
  if (!text || text.length < 10) return 20;

  let confidence = 90; // Start high for PDF

  // Check for common OCR artifacts that shouldn't be in PDF
  const ocrArtifacts = /[|]{2,}|_{3,}|\.{4,}/g;
  if (ocrArtifacts.test(text)) {
    confidence -= 20;
  }

  // Check for reasonable text density
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 5) {
    confidence -= 30;
  }

  // Check for numbers (invoices should have amounts, dates)
  const hasNumbers = /\d/.test(text);
  if (!hasNumbers) {
    confidence -= 15;
  }

  return Math.max(10, confidence);
}

/**
 * Generate mock OCR results for testing
 * TODO: replace with Tesseract.js
 */
function generateMockOCRResult(filePath) {
  const fileName = filePath.toLowerCase();

  // Different mock results based on file name to simulate various quality levels
  if (fileName.includes("amazon")) {
    return {
      text: `Amazon.com
Order Date: March 15, 2024
Order #: 111-7654321-9876543

Items:
- HP Ink Cartridge (2-pack) - $67.99
- Wireless Mouse - $24.99
Tax: $7.44
Total: $100.42`,
      confidence: 92,
    };
  } else if (fileName.includes("uber")) {
    return {
      text: `Uber
Trip on Mar 14, 2024
Downtown to Airport
Total: $28.50
Payment: Visa ****1234`,
      confidence: 88,
    };
  } else if (fileName.includes("restaurant") || fileName.includes("bistro")) {
    return {
      text: `THE BLUE DOOR BISTRO
Date: 03/14/24
Server: Jamie

Client Lunch - Johnson Account
Salmon Entree         32.00
Chicken Pasta         28.00
Coffee x2             8.00
Subtotal            68.00
Tax                  5.44
Tip                 13.60
TOTAL              $87.04`,
      confidence: 75, // Lower confidence for restaurant receipts
    };
  } else if (fileName.includes("blurry") || fileName.includes("poor")) {
    return {
      text: `St@rbucks C0ffee
D@te: 03/l5/2024
C@shier: M1ke

L@rge C0ffee    4.50
M0rning P@stry  3.25
T@x             0.62
T0t@l          $8.37`,
      confidence: 45, // Very low confidence for poor quality
    };
  } else {
    // Generic receipt
    return {
      text: `OFFICE DEPOT
Store #1234
Date: 03/16/2024

Paper Reams (5)     $24.95
Pens (Pack)         $8.99
Stapler             $12.50

Subtotal           $46.44
Tax                $3.72
Total             $50.16`,
      confidence: 85,
    };
  }
}

/**
 * Validate extracted text quality
 */
function validateExtractionQuality(extractionResult) {
  const { text, confidence } = extractionResult;

  const issues = [];
  let qualityScore = confidence;

  // Check text length
  if (text.length < 20) {
    issues.push("Very short text extracted - may be incomplete");
    qualityScore -= 20;
  }

  // Check for currency symbols and numbers
  const hasCurrency = /\$|\d+\.\d{2}/.test(text);
  if (!hasCurrency) {
    issues.push("No currency amounts detected");
    qualityScore -= 15;
  }

  // Check for dates
  const hasDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(
    text
  );
  if (!hasDate) {
    issues.push("No date pattern detected");
    qualityScore -= 10;
  }

  return {
    qualityScore: Math.max(0, qualityScore),
    issues,
    needsReview: qualityScore < 70,
  };
}

module.exports = {
  extractText,
  validateExtractionQuality,
  calculatePDFConfidence,
};

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { createWorker } = require("tesseract.js");
const sharp = require("sharp");

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

  try {
    // First try PDF text extraction
    const data = await pdfParse(dataBuffer, {
      max: 0, // parse all pages
      version: "v1.10.100",
    });

    const processingTime = Date.now() - startTime;

    // Check if PDF has meaningful text content
    const cleanText = data.text.trim().replace(/\s+/g, " ");
    const hasMinimumText = cleanText.length > 50;
    const hasNumbers = /\d/.test(cleanText);
    const hasCurrency = /\$|\d+\.\d{2}/.test(cleanText);

    // If PDF appears to be text-based with good content, use it
    if (hasMinimumText && (hasNumbers || hasCurrency)) {
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
          textLength: cleanText.length,
        },
      };
    } else {
      // PDF might be scanned/image-based, try OCR
      console.log("PDF appears to be image-based, attempting OCR...");
      return await extractFromScannedPDF(filePath);
    }
  } catch (pdfError) {
    console.log("PDF parsing failed, trying OCR fallback:", pdfError.message);
    return await extractFromScannedPDF(filePath);
  }
}

/**
 * Extract text from scanned PDF using OCR
 */
async function extractFromScannedPDF(filePath) {
  const startTime = Date.now();

  try {
    // For now, use Tesseract directly on the PDF
    // In production, you'd convert PDF pages to images first
    const worker = await createWorker();

    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    // Configure OCR for better invoice/receipt recognition
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,/:-# ",
      tessedit_pageseg_mode: "6", // Uniform block of text
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(filePath);
    await worker.terminate();

    const processingTime = Date.now() - startTime;

    return {
      text: text || "No text detected in scanned PDF",
      pageCount: 1, // Simplified for MVP
      extractionMethod: "pdf-ocr",
      processingTime,
      confidence: Math.round(confidence || 0),
      metadata: {
        ocrEngine: "tesseract",
        language: "eng",
        originalFormat: "pdf",
      },
    };
  } catch (error) {
    console.error("PDF OCR failed:", error);

    // Return minimal result to prevent complete failure
    return {
      text: `OCR processing failed for PDF: ${error.message}`,
      pageCount: 1,
      extractionMethod: "pdf-ocr-failed",
      processingTime: Date.now() - startTime,
      confidence: 0,
      metadata: {
        error: error.message,
        originalFormat: "pdf",
      },
    };
  }
}

/**
 * Extract text from image files using Tesseract.js OCR
 */
async function extractFromImage(filePath) {
  const startTime = Date.now();

  try {
    // Pre-process image for better OCR results
    const processedImagePath = await preprocessImage(filePath);

    const worker = await createWorker({
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    // Configure Tesseract for invoice/receipt processing
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$.,/:-# ()[]@",
      tessedit_pageseg_mode: "6", // Uniform block of text
      preserve_interword_spaces: "1",
    });

    const {
      data: { text, confidence, words },
    } = await worker.recognize(processedImagePath);
    await worker.terminate();

    // Clean up processed image if different from original
    if (processedImagePath !== filePath) {
      try {
        fs.unlinkSync(processedImagePath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup processed image:", cleanupError);
      }
    }

    const processingTime = Date.now() - startTime;

    // Calculate more detailed confidence based on word-level data
    const adjustedConfidence = calculateOCRConfidence(text, confidence, words);

    return {
      text: text || "No text detected in image",
      pageCount: 1,
      extractionMethod: "ocr",
      processingTime,
      confidence: adjustedConfidence,
      metadata: {
        ocrEngine: "tesseract",
        language: "eng",
        wordCount: words ? words.length : 0,
        rawConfidence: confidence,
      },
    };
  } catch (error) {
    console.error("Image OCR failed:", error);

    // Return error result but don't throw to prevent complete failure
    return {
      text: `OCR processing failed: ${error.message}`,
      pageCount: 1,
      extractionMethod: "ocr-failed",
      processingTime: Date.now() - startTime,
      confidence: 0,
      metadata: {
        error: error.message,
        ocrEngine: "tesseract",
      },
    };
  }
}

/**
 * Preprocess image for better OCR results
 */
async function preprocessImage(filePath) {
  try {
    const fileExt = path.extname(filePath);
    const processedPath = filePath.replace(fileExt, `_processed${fileExt}`);

    await sharp(filePath)
      .grayscale() // Convert to grayscale
      .normalise() // Normalize contrast
      .sharpen() // Sharpen text
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFile(processedPath);

    return processedPath;
  } catch (error) {
    console.warn("Image preprocessing failed, using original:", error.message);
    return filePath; // Use original if preprocessing fails
  }
}

/**
 * Calculate confidence score for PDF extraction
 */
function calculatePDFConfidence(text) {
  if (!text || text.length < 10) return 20;

  let confidence = 85; // Start lower than before since we now have OCR comparison

  // Check for common OCR artifacts that shouldn't be in clean PDF text
  const ocrArtifacts = /[|]{2,}|_{3,}|\.{4,}|[^\w\s$.,/:-#()]/g;
  if (ocrArtifacts.test(text)) {
    confidence -= 15;
  }

  // Check for reasonable text density
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 5) {
    confidence -= 25;
  } else if (words.length > 50) {
    confidence += 10; // Bonus for substantial content
  }

  // Check for numbers and currency (expected in invoices)
  const hasNumbers = /\d/.test(text);
  const hasCurrency = /\$|\d+\.\d{2}/.test(text);
  const hasDate = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);

  if (!hasNumbers) confidence -= 20;
  if (!hasCurrency) confidence -= 10;
  if (hasDate) confidence += 5;

  // Check text structure (invoices should have some structure)
  const hasLineBreaks = text.includes("\n");
  const hasColon = text.includes(":");
  if (hasLineBreaks && hasColon) confidence += 5;

  return Math.max(10, Math.min(95, confidence));
}

/**
 * Calculate OCR confidence with additional validation
 */
function calculateOCRConfidence(text, rawConfidence, words = []) {
  if (!text || text.length < 5) return 0;

  let adjustedConfidence = rawConfidence || 0;

  // Penalize very short text
  if (text.length < 20) {
    adjustedConfidence *= 0.7;
  }

  // Bonus for finding currency amounts
  const currencyMatches = text.match(/\$\d+\.\d{2}/g);
  if (currencyMatches && currencyMatches.length > 0) {
    adjustedConfidence += 10;
  }

  // Bonus for finding dates
  const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
  if (dateMatches && dateMatches.length > 0) {
    adjustedConfidence += 5;
  }

  // Penalize text with too many special characters (OCR artifacts)
  const specialCharRatio =
    (text.match(/[^a-zA-Z0-9\s$.,/:-]/g) || []).length / text.length;
  if (specialCharRatio > 0.1) {
    adjustedConfidence *= 1 - specialCharRatio;
  }

  // Word-level confidence validation
  if (words && words.length > 0) {
    const lowConfidenceWords = words.filter(
      (word) => word.confidence < 60
    ).length;
    const lowConfidenceRatio = lowConfidenceWords / words.length;

    if (lowConfidenceRatio > 0.3) {
      adjustedConfidence *= 1 - lowConfidenceRatio * 0.5;
    }
  }

  return Math.max(0, Math.min(100, Math.round(adjustedConfidence)));
}

/**
 * Validate extracted text quality
 */
function validateExtractionQuality(extractionResult) {
  const { text, confidence, extractionMethod } = extractionResult;

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

  // OCR-specific checks
  if (extractionMethod.includes("ocr")) {
    if (confidence < 70) {
      issues.push("Low OCR confidence - image quality may be poor");
      qualityScore -= 10;
    }

    // Check for common OCR errors
    const ocrErrorPatterns = /[|]{2,}|_{3,}|\s{5,}/g;
    if (ocrErrorPatterns.test(text)) {
      issues.push("OCR artifacts detected - may need manual review");
      qualityScore -= 5;
    }
  }

  // PDF-specific checks
  if (extractionMethod === "pdf" && confidence < 80) {
    issues.push("PDF extraction had issues - might be image-based");
  }

  return {
    qualityScore: Math.max(0, qualityScore),
    issues,
    needsReview: qualityScore < 70 || issues.length > 2,
    extractionMethod,
  };
}

module.exports = {
  extractText,
  validateExtractionQuality,
  calculatePDFConfidence,
  calculateOCRConfidence,
};

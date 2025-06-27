/**
 * LLM-Powered Invoice Parser
 * Uses OpenAI GPT or Google Gemini to parse raw OCR text into structured data
 */

const OpenAI = require("openai"); // npm install openai
const { GoogleGenerativeAI } = require("@google/generative-ai"); // npm install @google/generative-ai

class LLMInvoiceParser {
  constructor(options = {}) {
    this.provider = options.provider || "gemini"; // 'openai' or 'gemini'
    this.maxRetries = options.maxRetries || 2;

    if (this.provider === "openai") {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } else if (this.provider === "gemini") {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
  }

  /**
   * Parse invoice using LLM
   */
  async parseInvoiceWithLLM(rawText, metadata = {}) {
    console.log("Parsing invoice with LLM...");

    try {
      const prompt = this.buildPrompt(rawText, metadata);
      let response;

      if (this.provider === "openai") {
        response = await this.parseWithOpenAI(prompt);
      } else {
        response = await this.parseWithGemini(prompt);
        console.log(`Response from gemini : ${response}`);
      }

      const parsedData = this.parseResponse(response);

      // Validate and enhance the response
      const validatedData = this.validateParsedData(parsedData, rawText);

      console.log("LLM parsing completed:", {
        vendor: validatedData.vendor,
        amount: validatedData.amount,
        lineItemsCount: validatedData.lineItems?.length || 0,
      });

      return validatedData;
    } catch (error) {
      console.error("LLM parsing failed:", error);
      throw new Error(`LLM parsing error: ${error.message}`);
    }
  }

  /**
   * Build the prompt for LLM
   */
  buildPrompt(rawText, metadata) {
    return `You are an expert at extracting structured data from invoice and receipt text. 

The following text was extracted from an invoice/receipt using OCR and may contain errors (like "ss68" instead of "$5.68"):

---
${rawText}
---

Please extract the following information and return ONLY a valid JSON object with these exact fields:

{
  "vendor": "string - the business/company name",
  "date": "YYYY-MM-DD - the invoice/transaction date",
  "amount": "number - the total amount (fix OCR errors like ss68 -> 5.68)",
  "lineItems": [
    {
      "description": "string - item/service description",
      "amount": "number - individual item amount",
      "quantity": "number - quantity (default 1)"
    }
  ],
  "tax": "number - tax amount (0 if not found)",
  "subtotal": "number - subtotal before tax (0 if not found)",
  "confidence": "number - your confidence in the extraction (0-100)"
}

IMPORTANT RULES:
1. Fix common OCR errors (ss -> $, 0 -> O, 1 -> I, etc.)
2. For line items, extract actual products/services, NOT addresses, store info, or headers
3. Skip shipping addresses, phone numbers, store numbers, receipts headers
4. If you see items like "9014 S Yale Ave" or "Draver: 1 Reg" - these are NOT products
5. For Starbucks: extract drinks like "Iced Americano", "Caramel Frappuccino" 
6. For Amazon: extract actual products like "Headphones Adapter"
7. Amount should be the final total (not subtotal)
8. Return only the JSON, no other text

Examples of what TO extract as line items:
- "Vt Iced Americano" (Starbucks drink)
- "JEEUE Headphones Adapter" (Amazon product) 
- "Basic Plan Nov 5 – Dec 5, 2024" (Subscription)

Examples of what NOT to extract:
- "9014 S Yale Ave" (address)
- "Draver: 1 Reg" (register info)
- "STARBUCKS Store #13634" (store header)
- "Shipping Address:" (label)`;
  }

  /**
   * Parse with OpenAI
   */
  async parseWithOpenAI(prompt) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or "gpt-4" for better accuracy
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  }

  /**
   * Parse with Google Gemini (Free tier)
   */
  async parseWithGemini(prompt) {
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   * Parse the LLM response into structured data with better validation
   */
  parseResponse(responseText) {
    try {
      // Clean the response - remove any markdown formatting
      let cleanText = responseText.trim();

      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\s*|\s*```/g, "");
      cleanText = cleanText.replace(/```\s*|\s*```/g, "");

      // Parse JSON
      const parsed = JSON.parse(cleanText);

      // Ensure required fields exist with proper validation
      const result = {
        vendor: parsed.vendor || "Unknown Vendor",
        date: this.parseDate(parsed.date), // This will always return a valid Date
        amount: parseFloat(parsed.amount) || 0,
        lineItems: Array.isArray(parsed.lineItems)
          ? parsed.lineItems.map((item) => ({
              description: String(item.description || "").trim(),
              amount: parseFloat(item.amount) || 0,
              quantity: parseInt(item.quantity) || 1,
            }))
          : [],
        tax: parseFloat(parsed.tax) || 0,
        subtotal: parseFloat(parsed.subtotal) || 0,
        confidence: parseInt(parsed.confidence) || 50,
        parsingMethod: "llm",
      };

      // Double-check date is valid before returning
      if (isNaN(result.date.getTime())) {
        console.warn("Date validation failed, using current date");
        result.date = new Date();
      }

      return result;
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      console.error("Raw response:", responseText);

      // Fallback parsing - try to extract basic info
      return this.fallbackParsing(responseText);
    }
  }

  /**
   * Parse date string to Date object with better validation
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();

    try {
      // Handle common date formats
      let date;

      // Try ISO format first
      if (typeof dateStr === "string" && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        date = new Date(dateStr);
      }
      // Try MM/DD/YYYY format
      else if (
        typeof dateStr === "string" &&
        dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)
      ) {
        date = new Date(dateStr);
      }
      // Try other common formats
      else {
        date = new Date(dateStr);
      }

      // Validate the date
      if (isNaN(date.getTime()) || date.getTime() === 0) {
        console.warn(`Invalid date parsed: ${dateStr}, using current date`);
        return new Date();
      }

      // Check if date is reasonable (not too far in past/future)
      const now = new Date();
      const fiveYearsAgo = new Date(now.getFullYear() - 5, 0, 1);
      const oneYearFromNow = new Date(now.getFullYear() + 1, 11, 31);

      if (date < fiveYearsAgo || date > oneYearFromNow) {
        console.warn(`Date ${dateStr} seems unreasonable, using current date`);
        return new Date();
      }

      return date;
    } catch (error) {
      console.warn(`Error parsing date ${dateStr}:`, error.message);
      return new Date();
    }
  }

  /**
   * Fallback parsing if JSON parsing fails
   */
  fallbackParsing(responseText) {
    console.warn("Using fallback parsing for LLM response");

    return {
      vendor: "Unknown Vendor",
      date: new Date(), // Always use current date as fallback
      amount: 0,
      lineItems: [],
      tax: 0,
      subtotal: 0,
      confidence: 10,
      parsingMethod: "llm-fallback",
      rawResponse: responseText,
    };
  }

  /**
   * Validate and enhance parsed data
   */
  validateParsedData(data, originalText) {
    // Basic validation
    if (data.amount <= 0) {
      // Try to find amount in original text as backup
      const amountMatch = originalText.match(/\$?(\d+\.\d{2})/);
      if (amountMatch) {
        data.amount = parseFloat(amountMatch[1]);
      }
    }

    // Validate line items
    data.lineItems = data.lineItems.filter(
      (item) =>
        item.description &&
        item.description.length > 2 &&
        item.amount > 0 &&
        item.amount < 10000 &&
        !this.isExcludedDescription(item.description)
    );

    // Calculate confidence based on data quality
    if (data.confidence < 50) {
      data.confidence = this.calculateConfidence(data, originalText);
    }

    return data;
  }

  /**
   * Check if description should be excluded
   */
  isExcludedDescription(description) {
    const excludePatterns = [
      /^\d+\s+(gateway|main|park|oak|elm|ave|street|st|rd|blvd)/i,
      /^[a-zA-Z\s]+,\s+[A-Z]{2}\s+\d{5}/i, // Addresses
      /^\(\d{3}\)\s*\d{3}-\d{4}$/i, // Phone numbers
      /^(store|order|reg|driver|receipt|invoice)/i,
    ];

    return excludePatterns.some((pattern) => pattern.test(description));
  }

  /**
   * Calculate confidence based on extracted data quality
   */
  calculateConfidence(data, originalText) {
    let confidence = 50;

    if (data.vendor !== "Unknown Vendor") confidence += 20;
    if (data.amount > 0) confidence += 20;
    if (data.lineItems.length > 0) confidence += 10;
    if (data.tax > 0 || data.subtotal > 0) confidence += 5;

    // Check if key elements are present in original text
    if (originalText.toLowerCase().includes(data.vendor.toLowerCase()))
      confidence += 5;

    return Math.min(100, Math.max(10, confidence));
  }
}

/**
 * Integration function for your existing system
 */
async function parseInvoiceDataWithLLM(rawText, metadata = {}) {
  const parser = new LLMInvoiceParser({
    provider: process.env.LLM_PROVIDER || "gemini", // Default to free Gemini
    maxRetries: 2,
  });

  try {
    return await parser.parseInvoiceWithLLM(rawText, metadata);
  } catch (error) {
    console.error("LLM parsing failed:", error);

    // Fallback to your existing rule-based parsing
    const { parseInvoiceData } = require("./dataParser");
    const fallbackResult = parseInvoiceData(rawText, metadata);

    return {
      ...fallbackResult,
      parsingMethod: "fallback",
      llmError: error.message,
    };
  }
}

/**
 * Batch processing for multiple invoices
 */
async function batchParseInvoices(invoices, options = {}) {
  const parser = new LLMInvoiceParser(options);
  const results = [];
  const batchSize = options.batchSize || 5; // Process 5 at a time to avoid rate limits

  for (let i = 0; i < invoices.length; i += batchSize) {
    const batch = invoices.slice(i, i + batchSize);

    const batchPromises = batch.map(async (invoice) => {
      try {
        const result = await parser.parseInvoiceWithLLM(
          invoice.rawText,
          invoice.metadata
        );
        return { ...result, id: invoice.id, success: true };
      } catch (error) {
        return {
          id: invoice.id,
          success: false,
          error: error.message,
          parsingMethod: "failed",
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay to respect rate limits
    if (i + batchSize < invoices.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Cost estimation helper
 */
function estimateCost(textLength, provider = "gemini") {
  const costs = {
    gemini: {
      // Gemini has generous free tier
      tokensPerRequest: Math.ceil(textLength / 4), // Rough token estimation
      freeLimit: 1500, // requests per day
      costPerToken: 0, // Free tier
    },
    openai: {
      tokensPerRequest: Math.ceil(textLength / 4),
      costPer1kTokens: 0.002, // GPT-3.5-turbo input cost
    },
  };

  const config = costs[provider];
  if (!config) return { error: "Unknown provider" };

  if (provider === "gemini") {
    return {
      tokensPerRequest: config.tokensPerRequest,
      cost: 0,
      freeLimit: config.freeLimit,
      note: "Gemini has generous free tier",
    };
  } else {
    return {
      tokensPerRequest: config.tokensPerRequest,
      costPerRequest: (config.tokensPerRequest / 1000) * config.costPer1kTokens,
      costPer1000Requests: config.costPer1kTokens * config.tokensPerRequest,
    };
  }
}

module.exports = {
  LLMInvoiceParser,
  parseInvoiceDataWithLLM,
  batchParseInvoices,
  estimateCost,
};

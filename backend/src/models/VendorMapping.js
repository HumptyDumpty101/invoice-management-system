const mongoose = require("mongoose");

const vendorMappingSchema = new mongoose.Schema(
  {
    vendor: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    normalizedVendor: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
    confidence: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    averageAmount: {
      type: Number,
      default: 0,
    },
    amountRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    userCorrections: {
      type: Number,
      default: 0,
    },
    autoAssigned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for vendor-category lookups
vendorMappingSchema.index({ normalizedVendor: 1, category: 1 });
vendorMappingSchema.index({ confidence: -1, count: -1 });

// Method to update mapping with new transaction
vendorMappingSchema.statics.updateMapping = async function (
  vendor,
  category,
  amount,
  isUserCorrected = false
) {
  const normalizedVendor = vendor
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const mapping = await this.findOne({ normalizedVendor, category });

  if (mapping) {
    // Update existing mapping
    mapping.count += 1;
    mapping.lastUsed = new Date();

    // Update amount statistics
    if (amount > 0) {
      const totalAmount = mapping.averageAmount * (mapping.count - 1) + amount;
      mapping.averageAmount = totalAmount / mapping.count;
      mapping.amountRange.min = Math.min(
        mapping.amountRange.min || amount,
        amount
      );
      mapping.amountRange.max = Math.max(
        mapping.amountRange.max || amount,
        amount
      );
    }

    // Boost confidence for user corrections
    if (isUserCorrected) {
      mapping.userCorrections += 1;
      mapping.confidence = Math.min(
        100,
        mapping.confidence + 10 // Boost confidence by 10% for user corrections
      );
    } else {
      // Gradually increase confidence based on usage
      mapping.confidence = Math.min(
        100,
        50 + (mapping.count - 1) * 5 + mapping.userCorrections * 10
      );
    }

    await mapping.save();
  } else {
    // Create new mapping
    await this.create({
      vendor,
      normalizedVendor,
      category,
      count: 1,
      confidence: isUserCorrected ? 70 : 50, // Higher initial confidence for user corrections
      averageAmount: amount || 0,
      amountRange: {
        min: amount || 0,
        max: amount || 0,
      },
      userCorrections: isUserCorrected ? 1 : 0,
      autoAssigned: !isUserCorrected,
    });
  }

  // Decay confidence for other categories of the same vendor
  await this.updateMany(
    { normalizedVendor, category: { $ne: category } },
    {
      $mul: { confidence: 0.95 }, // Reduce confidence by 5%
    }
  );
};

// Method to get best category prediction
vendorMappingSchema.statics.predictCategory = async function (vendor, amount) {
  const normalizedVendor = vendor
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Find all mappings for this vendor
  const mappings = await this.find({ normalizedVendor })
    .sort({ confidence: -1, count: -1 })
    .limit(5);

  if (mappings.length === 0) {
    return null;
  }

  // Calculate weighted scores for each mapping
  const scoredMappings = mappings.map((mapping) => {
    let score = mapping.confidence;

    // Boost score based on usage count (logarithmic scale)
    score += Math.log10(mapping.count + 1) * 10;

    // Boost score for recent usage
    const daysSinceLastUse =
      (Date.now() - mapping.lastUsed) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUse < 30) {
      score += 10;
    } else if (daysSinceLastUse < 90) {
      score += 5;
    }

    // Boost score for user corrections
    score += mapping.userCorrections * 15;

    // Mild penalty if amount is outside typical range (reduced from original)
    if (amount && mapping.amountRange.min > 0 && mapping.amountRange.max > 0) {
      if (
        amount < mapping.amountRange.min * 0.5 ||
        amount > mapping.amountRange.max * 2
      ) {
        score -= 5; // Reduced penalty
      }
    }

    return {
      ...mapping.toObject(),
      score,
    };
  });

  // Sort by score
  scoredMappings.sort((a, b) => b.score - a.score);

  return {
    category: scoredMappings[0].category,
    confidence: Math.round(scoredMappings[0].confidence),
    reason: `Based on ${scoredMappings[0].count} previous transactions`,
    score: scoredMappings[0].score,
    alternatives: scoredMappings.slice(1, 3).map((m) => ({
      category: m.category,
      confidence: Math.round(m.confidence),
    })),
  };
};

module.exports = mongoose.model("VendorMapping", vendorMappingSchema);

// backend/src/routes/categories.js - Updated predictCategoryForVendor function
async function predictCategoryForVendor(vendor, amount) {
  const vendorLower = vendor.toLowerCase();

  // First, check learning system
  const VendorMapping = require("../models/VendorMapping");
  const learnedPrediction = await VendorMapping.predictCategory(vendor, amount);

  if (learnedPrediction && learnedPrediction.confidence >= 60) {
    // Use learned prediction if confidence is good
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

  // Fallback to rule-based for NEW vendors only
  const rules = [
    // Technology & Software - More specific patterns
    {
      pattern: /\b(midjourney|openai|chatgpt|claude|anthropic)\b/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 90,
    },
    {
      pattern: /amazon\s*(web\s*services|aws)|amzn.*aws/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 90,
    },
    {
      pattern: /amazon|amzn(?!.*aws)/i,
      category: "5010",
      name: "Office Supplies",
      confidence: 70, // Lower confidence for generic Amazon
    },
    {
      pattern:
        /microsoft|adobe|slack|zoom|dropbox|google\s*(workspace|cloud)|github/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 90,
    },
    // Add more specific patterns...
  ];

  // Check rules
  for (const rule of rules) {
    if (rule.pattern.test(vendorLower)) {
      return {
        category: rule.category,
        name: rule.name,
        confidence: rule.confidence,
        reason: `Matched vendor pattern: ${vendor}`,
        alternatives: getAlternativeCategories(rule.category, 2),
      };
    }
  }

  // For completely unknown vendors, use very low confidence amount-based suggestion
  // But emphasize that user should correct it
  const amountNum = parseFloat(amount);
  if (!isNaN(amountNum)) {
    let suggestion = {
      category: "5140",
      name: "Miscellaneous Expenses",
      confidence: 30, // Very low confidence
      reason: "Unknown vendor - please select appropriate category",
      alternatives: [],
    };

    // Only suggest based on amount ranges with VERY low confidence
    if (amountNum < 20) {
      suggestion = {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 25, // Even lower
        reason: "Unknown vendor with small amount - please verify category",
        alternatives: getAlternativeCategories("5050", 3),
      };
    } else if (amountNum < 100) {
      suggestion = {
        category: "5010",
        name: "Office Supplies",
        confidence: 25,
        reason: "Unknown vendor with medium amount - please verify category",
        alternatives: getAlternativeCategories("5010", 3),
      };
    }

    return suggestion;
  }

  // Ultimate fallback
  return {
    category: "5140",
    name: "Miscellaneous Expenses",
    confidence: 20,
    reason: "Could not determine category - please select manually",
    alternatives: getAlternativeCategories("5140", 3),
  };
}

// backend/src/routes/invoices.js - Update the updateVendorLearning function
async function updateVendorLearning(
  vendor,
  category,
  amount,
  isUserCorrected = true
) {
  try {
    const VendorMapping = require("../models/VendorMapping");
    await VendorMapping.updateMapping(
      vendor,
      category,
      amount,
      isUserCorrected
    );
    console.log(
      `Learning updated: ${vendor} -> ${category} (corrected: ${isUserCorrected})`
    );
  } catch (error) {
    console.error("Failed to update learning system:", error);
  }
}

// backend/src/routes/upload.js - Update the predictCategory function
async function predictCategory(vendor, amount) {
  try {
    // First check learning system
    const VendorMapping = require("../models/VendorMapping");
    const learnedPrediction = await VendorMapping.predictCategory(
      vendor,
      amount
    );

    if (learnedPrediction && learnedPrediction.confidence >= 50) {
      return {
        category: learnedPrediction.category,
        confidence: learnedPrediction.confidence,
        reason: learnedPrediction.reason,
      };
    }

    // Fallback to rule-based prediction
    const categoryPrediction = await predictCategoryFromRules(vendor, amount);

    // Auto-learn from initial prediction (with low confidence)
    if (categoryPrediction && categoryPrediction.category) {
      await VendorMapping.updateMapping(
        vendor,
        categoryPrediction.category,
        amount,
        false // Not user corrected
      );
    }

    return categoryPrediction;
  } catch (error) {
    console.error("Category prediction error:", error);
    return {
      category: "5140",
      confidence: 20,
      reason: "Prediction error - please select category manually",
    };
  }
}

// Helper function for rule-based prediction
async function predictCategoryFromRules(vendor, amount) {
  // Similar to the rules in predictCategoryForVendor but simplified
  const vendorLower = vendor.toLowerCase();

  const rules = {
    // Software/Tech with high confidence
    midjourney: { category: "5020", confidence: 95 },
    openai: { category: "5020", confidence: 95 },
    adobe: { category: "5020", confidence: 90 },
    microsoft: { category: "5020", confidence: 90 },
    google: { category: "5020", confidence: 85 },
    zoom: { category: "5020", confidence: 90 },
    slack: { category: "5020", confidence: 90 },

    // Transportation
    uber: { category: "5040", confidence: 90 },
    lyft: { category: "5040", confidence: 90 },

    // Food with medium confidence
    starbucks: { category: "5050", confidence: 80 },
    restaurant: { category: "5050", confidence: 75 },
    cafe: { category: "5050", confidence: 75 },

    // Office/Retail with lower confidence
    amazon: { category: "5010", confidence: 60 },
    walmart: { category: "5010", confidence: 65 },
    target: { category: "5010", confidence: 65 },
  };

  // Check each rule
  for (const [keyword, prediction] of Object.entries(rules)) {
    if (vendorLower.includes(keyword)) {
      return {
        category: prediction.category,
        confidence: prediction.confidence,
        reason: `Vendor matches known pattern: ${keyword}`,
      };
    }
  }

  // No pattern matched - return low confidence suggestion
  return {
    category: "5140",
    confidence: 25,
    reason: "Unknown vendor type",
  };
}

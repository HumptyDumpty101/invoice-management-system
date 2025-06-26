const express = require("express");
const { validateCategoryCode } = require("../utils/validation");

const router = express.Router();

// Default chart of accounts categories
const defaultCategories = [
  // Assets
  {
    code: "1000",
    name: "Business Checking",
    description: "Primary business bank account",
    isDefault: true,
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    description: "Money owed by customers",
    isDefault: true,
  },
  {
    code: "1200",
    name: "Inventory",
    description: "Products for sale",
    isDefault: true,
  },
  {
    code: "1300",
    name: "Equipment",
    description: "Business equipment and machinery",
    isDefault: true,
  },

  // Liabilities
  {
    code: "2000",
    name: "Accounts Payable",
    description: "Money owed to vendors",
    isDefault: true,
  },
  {
    code: "2100",
    name: "Credit Card",
    description: "Business credit card balances",
    isDefault: true,
  },
  {
    code: "2200",
    name: "Loans Payable",
    description: "Business loans and financing",
    isDefault: true,
  },

  // Equity
  {
    code: "3000",
    name: "Owner Equity",
    description: "Owner investment and retained earnings",
    isDefault: true,
  },

  // Revenue
  {
    code: "4000",
    name: "Sales Revenue",
    description: "Income from sales",
    isDefault: true,
  },
  {
    code: "4100",
    name: "Service Revenue",
    description: "Income from services",
    isDefault: true,
  },

  // Expenses (Most commonly used for invoices)
  {
    code: "5010",
    name: "Office Supplies",
    description: "Pens, paper, printer cartridges, basic office items",
    isDefault: true,
  },
  {
    code: "5020",
    name: "Software Subscriptions",
    description: "Adobe, Microsoft, Slack, SaaS tools",
    isDefault: true,
  },
  {
    code: "5030",
    name: "Internet & Phone",
    description: "Comcast, AT&T, Zoom, communication services",
    isDefault: true,
  },
  {
    code: "5040",
    name: "Travel & Transportation",
    description: "Flights, Uber, parking, business travel",
    isDefault: true,
  },
  {
    code: "5050",
    name: "Meals & Entertainment",
    description: "Client dinners, team lunches, business meals",
    isDefault: true,
  },
  {
    code: "5060",
    name: "Professional Services",
    description: "Legal, accounting, consulting, contractors",
    isDefault: true,
  },
  {
    code: "5070",
    name: "Marketing & Advertising",
    description: "Google Ads, Facebook, print materials, promotion",
    isDefault: true,
  },
  {
    code: "5080",
    name: "Rent & Utilities",
    description: "Office rent, electricity, water, gas",
    isDefault: true,
  },
  {
    code: "5090",
    name: "Insurance",
    description: "Business insurance, liability, property coverage",
    isDefault: true,
  },
  {
    code: "5100",
    name: "Equipment & Technology",
    description: "Computers, software, hardware purchases",
    isDefault: true,
  },
  {
    code: "5110",
    name: "Maintenance & Repairs",
    description: "Equipment repairs, building maintenance",
    isDefault: true,
  },
  {
    code: "5120",
    name: "Training & Education",
    description: "Courses, books, professional development",
    isDefault: true,
  },
  {
    code: "5130",
    name: "Bank Fees",
    description: "Transaction fees, service charges",
    isDefault: true,
  },
  {
    code: "5140",
    name: "Miscellaneous Expenses",
    description: "Other business expenses",
    isDefault: true,
  },
];

/**
 * GET /api/categories - Get all categories
 */
router.get("/", async (req, res) => {
  try {
    const categories = defaultCategories.map((cat) => ({
      ...cat,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Group by type for easier UI display
    const grouped = {
      assets: categories.filter((c) => c.code.startsWith("1")),
      liabilities: categories.filter((c) => c.code.startsWith("2")),
      equity: categories.filter((c) => c.code.startsWith("3")),
      revenue: categories.filter((c) => c.code.startsWith("4")),
      expenses: categories.filter((c) => c.code.startsWith("5")),
    };

    res.json({
      categories,
      grouped,
      total: categories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      error: "Failed to fetch categories",
      message: error.message,
    });
  }
});

/**
 * GET /api/categories/expenses - Get expense categories only (most used for invoices)
 */
router.get("/expenses", async (req, res) => {
  try {
    const expenseCategories = defaultCategories
      .filter((cat) => cat.code.startsWith("5"))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      categories: expenseCategories,
    });
  } catch (error) {
    console.error("Error fetching expense categories:", error);
    res.status(500).json({
      error: "Failed to fetch expense categories",
      message: error.message,
    });
  }
});

/**
 * GET /api/categories/:code - Get single category
 */
router.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const category = defaultCategories.find((cat) => cat.code === code);

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    res.json({
      ...category,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      error: "Failed to fetch category",
      message: error.message,
    });
  }
});

/**
 * POST /api/categories - Create new category (for future enhancement)
 */
router.post("/", async (req, res) => {
  try {
    const { code, name, description } = req.body;

    // Validate category code
    const codeValidation = validateCategoryCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({
        error: "Invalid category code",
        message: codeValidation.error,
      });
    }

    // Check if category already exists
    const exists = defaultCategories.find((cat) => cat.code === code);
    if (exists) {
      return res.status(409).json({
        error: "Category already exists",
        message: `Category with code ${code} already exists`,
      });
    }

    // Validate required fields
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        error: "Invalid category name",
        message: "Category name must be at least 2 characters",
      });
    }

    // For MVP, we'll simulate creation but not persist
    const newCategory = {
      code,
      name: name.trim(),
      description: description ? description.trim() : "",
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.status(201).json({
      success: true,
      category: newCategory,
      message:
        "Category created successfully (note: MVP does not persist custom categories)",
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      error: "Failed to create category",
      message: error.message,
    });
  }
});

/**
 * PUT /api/categories/:code - Update category (for future enhancement)
 */
router.put("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { name, description } = req.body;

    const category = defaultCategories.find((cat) => cat.code === code);

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    if (category.isDefault) {
      return res.status(400).json({
        error: "Cannot modify default categories",
        message: "Default categories cannot be modified in MVP",
      });
    }

    // Validate name
    if (name && name.trim().length < 2) {
      return res.status(400).json({
        error: "Invalid category name",
        message: "Category name must be at least 2 characters",
      });
    }

    const updatedCategory = {
      ...category,
      name: name ? name.trim() : category.name,
      description:
        description !== undefined ? description.trim() : category.description,
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      category: updatedCategory,
      message:
        "Category updated successfully (note: MVP does not persist changes)",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      error: "Failed to update category",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/categories/:code - Delete category (for future enhancement)
 */
router.delete("/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const category = defaultCategories.find((cat) => cat.code === code);

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    if (category.isDefault) {
      return res.status(400).json({
        error: "Cannot delete default categories",
        message: "Default categories cannot be deleted",
      });
    }

    res.json({
      success: true,
      message:
        "Category deleted successfully (note: MVP does not persist changes)",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      error: "Failed to delete category",
      message: error.message,
    });
  }
});

/**
 * GET /api/categories/predict/:vendor - Predict category for vendor
 * UPDATED: Removed all amount-based restrictions
 */
router.get("/predict/:vendor", async (req, res) => {
  try {
    const { vendor } = req.params;
    const { amount } = req.query;

    if (!vendor) {
      return res.status(400).json({
        error: "Vendor name is required",
      });
    }

    const prediction = await predictCategoryForVendor(vendor, amount);

    res.json({
      vendor,
      prediction,
      confidence: prediction.confidence,
      alternatives: prediction.alternatives || [],
    });
  } catch (error) {
    console.error("Error predicting category:", error);
    res.status(500).json({
      error: "Failed to predict category",
      message: error.message,
    });
  }
});

/**
 * Enhanced category prediction logic - REMOVED amount-based restrictions
 */
async function predictCategoryForVendor(vendor, amount) {
  const vendorLower = vendor.toLowerCase();

  // First, check learning system
  const VendorMapping = require("../models/VendorMapping");
  const learnedPrediction = await VendorMapping.predictCategory(vendor, amount);

  if (learnedPrediction && learnedPrediction.confidence >= 50) {
    // Use learned prediction if confidence is reasonable
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

  // Enhanced rule-based predictions for NEW vendors - NO AMOUNT RESTRICTIONS
  const rules = [
    // Technology & Software
    {
      pattern: /\b(midjourney|openai|chatgpt|claude|anthropic)\b/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 95,
    },
    {
      pattern: /amazon\s*(web\s*services|aws)|amzn.*aws/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 95,
    },
    {
      pattern: /amazon|amzn(?!.*aws)/i,
      category: "5010",
      name: "Office Supplies",
      confidence: 75,
    },
    {
      pattern:
        /microsoft|adobe|slack|zoom|dropbox|google\s*(workspace|cloud)|github/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 90,
    },
    {
      pattern: /apple\s*(app\s*store|music|icloud)|itunes|figma|notion/i,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 85,
    },

    // Transportation - NO AMOUNT LIMITS
    {
      pattern: /uber|lyft|taxi/i,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 95,
    },
    {
      pattern: /parking|airport|toll|gas|fuel|shell|exxon|bp|chevron/i,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 85,
    },
    {
      pattern: /united|delta|american\s*airlines|southwest|jetblue/i,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 95,
    },

    // Food & Entertainment - NO AMOUNT LIMITS
    {
      pattern: /starbucks|dunkin|coffee/i,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 90,
    },
    {
      pattern: /restaurant|bistro|cafe|diner|eatery|dining|grill|kitchen/i,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 85,
    },
    {
      pattern: /mcdonald|burger|pizza|kfc|subway|chipotle|taco\s*bell/i,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 90,
    },
    {
      pattern: /catering|food\s*delivery|doordash|grubhub|ubereats/i,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 85,
    },

    // Office & Retail
    {
      pattern: /office\s*depot|staples|best\s*buy/i,
      category: "5010",
      name: "Office Supplies",
      confidence: 90,
    },
    {
      pattern: /walmart|target|costco/i,
      category: "5010",
      name: "Office Supplies",
      confidence: 70,
    },

    // Professional Services
    {
      pattern: /lawyer|attorney|legal|law\s*firm/i,
      category: "5060",
      name: "Professional Services",
      confidence: 95,
    },
    {
      pattern: /accountant|cpa|bookkeep|tax\s*prep/i,
      category: "5060",
      name: "Professional Services",
      confidence: 95,
    },
    {
      pattern: /consultant|contractor|freelance/i,
      category: "5060",
      name: "Professional Services",
      confidence: 80,
    },

    // Utilities & Communications
    {
      pattern: /verizon|at&t|comcast|sprint|t-mobile/i,
      category: "5030",
      name: "Internet & Phone",
      confidence: 90,
    },
    {
      pattern: /electric|gas|water|utility|power|energy/i,
      category: "5080",
      name: "Rent & Utilities",
      confidence: 90,
    },

    // Marketing & Advertising
    {
      pattern: /facebook|instagram|linkedin|twitter|ads|advertising|marketing/i,
      category: "5070",
      name: "Marketing & Advertising",
      confidence: 85,
    },
    {
      pattern: /google\s*ads|facebook\s*ads|linkedin\s*ads/i,
      category: "5070",
      name: "Marketing & Advertising",
      confidence: 95,
    },

    // Equipment & Technology
    {
      pattern: /dell|hp|lenovo|apple\s*store|computer|laptop|server/i,
      category: "5100",
      name: "Equipment & Technology",
      confidence: 85,
    },

    // Training & Education
    {
      pattern:
        /course|training|education|udemy|coursera|pluralsight|linkedin\s*learning/i,
      category: "5120",
      name: "Training & Education",
      confidence: 90,
    },

    // Insurance
    {
      pattern: /insurance|coverage|policy|premium/i,
      category: "5090",
      name: "Insurance",
      confidence: 85,
    },

    // Bank & Financial
    {
      pattern: /bank|fee|charge|interest|finance|loan/i,
      category: "5130",
      name: "Bank Fees",
      confidence: 80,
    },

    // Hotels & Accommodation
    {
      pattern: /hotel|motel|inn|resort|lodging|accommodation/i,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 85,
    },
  ];

  // Check rules - NO AMOUNT-BASED LOGIC
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

  // Improved fallback logic without amount restrictions
  // Look for generic business indicators
  if (/\b(llc|inc|corp|ltd|company|co\.)\b/i.test(vendorLower)) {
    return {
      category: "5060",
      name: "Professional Services",
      confidence: 60,
      reason: "Business entity detected",
      alternatives: getAlternativeCategories("5060", 3),
    };
  }

  if (/\b(store|shop|market|retail)\b/i.test(vendorLower)) {
    return {
      category: "5010",
      name: "Office Supplies",
      confidence: 50,
      reason: "Retail establishment detected",
      alternatives: getAlternativeCategories("5010", 3),
    };
  }

  // Default fallback - NO amount-based suggestions
  return {
    category: "5140",
    name: "Miscellaneous Expenses",
    confidence: 30,
    reason: "Unknown vendor - please select appropriate category",
    alternatives: getAlternativeCategories("5140", 4),
  };
}

/**
 * Get alternative category suggestions
 */
function getAlternativeCategories(excludeCode, count = 2) {
  const expenseCategories = defaultCategories
    .filter((c) => c.code.startsWith("5") && c.code !== excludeCode)
    .slice(0, count);

  return expenseCategories.map((c) => ({
    category: c.code,
    name: c.name,
    confidence: Math.floor(Math.random() * 15) + 25, // 25-40% confidence
  }));
}

module.exports = router;
module.exports.defaultCategories = defaultCategories;

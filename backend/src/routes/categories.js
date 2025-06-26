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
    // For MVP, return static categories
    // In production, you'd store these in database and allow customization

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
    // In production, you'd save to database
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

    // In production, you'd also check if category is in use
    // const Invoice = require('../models/Invoice');
    // const inUse = await Invoice.countDocuments({ category: code });

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
 * Simple category prediction logic
 * In production, this would use a proper learning system
 */
async function predictCategoryForVendor(vendor, amount) {
  const vendorLower = vendor.toLowerCase();

  // Rule-based predictions for common vendors
  const rules = [
    // Technology & Software
    {
      pattern: /amazon|amzn/,
      category: "5010",
      name: "Office Supplies",
      confidence: 75,
    },
    {
      pattern: /microsoft|adobe|slack|zoom/,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 90,
    },
    {
      pattern: /apple|google|dropbox/,
      category: "5020",
      name: "Software Subscriptions",
      confidence: 85,
    },

    // Transportation
    {
      pattern: /uber|lyft|taxi/,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 95,
    },
    {
      pattern: /parking|airport/,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 90,
    },
    {
      pattern: /united|delta|american airlines/,
      category: "5040",
      name: "Travel & Transportation",
      confidence: 95,
    },

    // Food & Entertainment
    {
      pattern: /starbucks|dunkin|coffee/,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 80,
    },
    {
      pattern: /restaurant|bistro|cafe|diner/,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 85,
    },
    {
      pattern: /mcdonald|burger|pizza/,
      category: "5050",
      name: "Meals & Entertainment",
      confidence: 75,
    },

    // Office Supplies
    {
      pattern: /office depot|staples|best buy/,
      category: "5010",
      name: "Office Supplies",
      confidence: 90,
    },
    {
      pattern: /walmart|target/,
      category: "5010",
      name: "Office Supplies",
      confidence: 70,
    },

    // Professional Services
    {
      pattern: /lawyer|attorney|legal/,
      category: "5060",
      name: "Professional Services",
      confidence: 95,
    },
    {
      pattern: /accountant|cpa|bookkeep/,
      category: "5060",
      name: "Professional Services",
      confidence: 95,
    },
    {
      pattern: /consultant|contractor/,
      category: "5060",
      name: "Professional Services",
      confidence: 85,
    },

    // Utilities & Communications
    {
      pattern: /verizon|at&t|comcast|sprint/,
      category: "5030",
      name: "Internet & Phone",
      confidence: 90,
    },
    {
      pattern: /electric|gas|water|utility/,
      category: "5080",
      name: "Rent & Utilities",
      confidence: 90,
    },

    // Marketing
    {
      pattern: /facebook|instagram|linkedin|ads/,
      category: "5070",
      name: "Marketing & Advertising",
      confidence: 90,
    },
    {
      pattern: /print|design|marketing/,
      category: "5070",
      name: "Marketing & Advertising",
      confidence: 80,
    },
  ];

  // Check rules
  for (const rule of rules) {
    if (rule.pattern.test(vendorLower)) {
      const category = defaultCategories.find((c) => c.code === rule.category);
      return {
        category: rule.category,
        name: rule.name,
        confidence: rule.confidence,
        reason: `Matched vendor pattern: ${vendor}`,
        alternatives: getAlternativeCategories(rule.category, 2),
      };
    }
  }

  // Amount-based fallback predictions
  const amountNum = parseFloat(amount);
  if (!isNaN(amountNum)) {
    if (amountNum < 20) {
      return {
        category: "5050",
        name: "Meals & Entertainment",
        confidence: 60,
        reason: "Small amount suggests meal or refreshment",
        alternatives: getAlternativeCategories("5050", 2),
      };
    } else if (amountNum < 100) {
      return {
        category: "5010",
        name: "Office Supplies",
        confidence: 50,
        reason: "Medium amount suggests office supplies",
        alternatives: getAlternativeCategories("5010", 2),
      };
    } else {
      return {
        category: "5060",
        name: "Professional Services",
        confidence: 40,
        reason: "Large amount suggests professional service",
        alternatives: getAlternativeCategories("5060", 2),
      };
    }
  }

  // Default fallback
  return {
    category: "5140",
    name: "Miscellaneous Expenses",
    confidence: 30,
    reason: "No specific pattern matched",
    alternatives: getAlternativeCategories("5140", 3),
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
    confidence: Math.floor(Math.random() * 20) + 20, // Random low confidence
  }));
}

module.exports = router;

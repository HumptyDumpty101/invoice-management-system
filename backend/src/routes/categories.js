const express = require("express");
const Category = require("../models/Category");
const { validateCategoryCode } = require("../utils/validation");

const router = express.Router();

/**
 * GET /api/categories - Get all categories from database
 */
router.get("/", async (req, res) => {
  try {
    // Get categories from database, fallback to seeding if empty
    let categories = await Category.find({ isActive: true }).sort({ code: 1 });

    // If no categories exist, seed default ones
    if (categories.length === 0) {
      await Category.seedDefaultCategories();
      categories = await Category.find({ isActive: true }).sort({ code: 1 });
    }

    // Group by type for easier UI display
    const grouped = {
      assets: categories.filter((c) => c.code.startsWith("1")),
      liabilities: categories.filter((c) => c.code.startsWith("2")),
      equity: categories.filter((c) => c.code.startsWith("3")),
      revenue: categories.filter((c) => c.code.startsWith("4")),
      expenses: categories.filter((c) => c.code.startsWith("5")),
    };

    res.json({
      categories: categories.map((cat) => ({
        code: cat.code,
        name: cat.name,
        description: cat.description,
        isDefault: cat.isDefault,
        color: cat.color,
        usageCount: cat.usageCount,
        type: cat.getCategoryType(),
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      })),
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
 * GET /api/categories/expenses - Get expense categories only
 */
router.get("/expenses", async (req, res) => {
  try {
    let expenseCategories = await Category.find({
      code: /^5/,
      isActive: true,
    }).sort({ name: 1 });

    // Seed if empty
    if (expenseCategories.length === 0) {
      await Category.seedDefaultCategories();
      expenseCategories = await Category.find({
        code: /^5/,
        isActive: true,
      }).sort({ name: 1 });
    }

    res.json({
      categories: expenseCategories.map((cat) => ({
        code: cat.code,
        name: cat.name,
        description: cat.description,
        isDefault: cat.isDefault,
        usageCount: cat.usageCount,
      })),
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

    const category = await Category.findOne({ code, isActive: true });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    res.json({
      code: category.code,
      name: category.name,
      description: category.description,
      isDefault: category.isDefault,
      color: category.color,
      usageCount: category.usageCount,
      type: category.getCategoryType(),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
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
 * POST /api/categories - Create new category (FIXED)
 */
router.post("/", async (req, res) => {
  try {
    const { code, name, description, color } = req.body;

    // Validate category code
    const codeValidation = validateCategoryCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({
        error: "Invalid category code",
        message: codeValidation.error,
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ code });
    if (existingCategory) {
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

    // Create new category in database
    const newCategory = new Category({
      code: code.trim(),
      name: name.trim(),
      description: description ? description.trim() : "",
      color: color || "#3b82f6",
      isDefault: false,
      isActive: true,
      usageCount: 0,
    });

    await newCategory.save();

    res.status(201).json({
      success: true,
      category: {
        code: newCategory.code,
        name: newCategory.name,
        description: newCategory.description,
        isDefault: newCategory.isDefault,
        color: newCategory.color,
        type: newCategory.getCategoryType(),
        createdAt: newCategory.createdAt,
        updatedAt: newCategory.updatedAt,
      },
      message: "Category created successfully",
    });
  } catch (error) {
    console.error("Error creating category:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Category already exists",
        message: "A category with this code already exists",
      });
    }

    res.status(500).json({
      error: "Failed to create category",
      message: error.message,
    });
  }
});

/**
 * PUT /api/categories/:code - Update category (FIXED)
 */
router.put("/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { name, description, color } = req.body;

    const category = await Category.findOne({ code, isActive: true });

    if (!category) {
      return res.status(404).json({
        error: "Category not found",
      });
    }

    // Validate name if provided
    if (name && name.trim().length < 2) {
      return res.status(400).json({
        error: "Invalid category name",
        message: "Category name must be at least 2 characters",
      });
    }

    // Update category
    if (name) category.name = name.trim();
    if (description !== undefined) category.description = description.trim();
    if (color) category.color = color;

    await category.save();

    res.json({
      success: true,
      category: {
        code: category.code,
        name: category.name,
        description: category.description,
        isDefault: category.isDefault,
        color: category.color,
        type: category.getCategoryType(),
        updatedAt: category.updatedAt,
      },
      message: "Category updated successfully",
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
 * DELETE /api/categories/:code - Delete category (FIXED)
 */
router.delete("/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const category = await Category.findOne({ code, isActive: true });

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

    // Check if category is being used by any invoices
    const Invoice = require("../models/Invoice");
    const usageCount = await Invoice.countDocuments({ category: code });

    if (usageCount > 0) {
      return res.status(400).json({
        error: "Category is in use",
        message: `Cannot delete category that is used by ${usageCount} invoice(s)`,
      });
    }

    // Soft delete by setting isActive to false
    category.isActive = false;
    await category.save();

    res.json({
      success: true,
      message: "Category deleted successfully",
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
 * Enhanced category prediction using database categories
 */
async function predictCategoryForVendor(vendor, amount) {
  const vendorLower = vendor.toLowerCase();

  // First, check learning system
  const VendorMapping = require("../models/VendorMapping");
  const learnedPrediction = await VendorMapping.predictCategory(vendor, amount);

  if (learnedPrediction && learnedPrediction.confidence >= 50) {
    // Get category from database
    const category = await Category.findOne({
      code: learnedPrediction.category,
      isActive: true,
    });

    return {
      category: learnedPrediction.category,
      name: category ? category.name : "Unknown Category",
      confidence: learnedPrediction.confidence,
      reason: learnedPrediction.reason,
      alternatives: learnedPrediction.alternatives,
    };
  }

  // Enhanced rule-based predictions for NEW vendors
  const rules = [
    // Technology & Software
    {
      pattern: /\b(midjourney|openai|chatgpt|claude|anthropic)\b/i,
      category: "5020",
      confidence: 95,
    },
    {
      pattern: /amazon\s*(web\s*services|aws)|amzn.*aws/i,
      category: "5020",
      confidence: 95,
    },
    {
      pattern: /amazon|amzn(?!.*aws)/i,
      category: "5010",
      confidence: 75,
    },
    {
      pattern:
        /microsoft|adobe|slack|zoom|dropbox|google\s*(workspace|cloud)|github/i,
      category: "5020",
      confidence: 90,
    },
    // Transportation
    {
      pattern: /uber|lyft|taxi/i,
      category: "5040",
      confidence: 95,
    },
    // Food & Entertainment
    {
      pattern: /starbucks|dunkin|coffee/i,
      category: "5050",
      confidence: 90,
    },
    {
      pattern: /restaurant|bistro|cafe|diner|eatery/i,
      category: "5050",
      confidence: 85,
    },
  ];

  // Check rules
  for (const rule of rules) {
    if (rule.pattern.test(vendorLower)) {
      const category = await Category.findOne({
        code: rule.category,
        isActive: true,
      });

      return {
        category: rule.category,
        name: category ? category.name : "Unknown Category",
        confidence: rule.confidence,
        reason: `Matched vendor pattern: ${vendor}`,
        alternatives: await getAlternativeCategories(rule.category, 2),
      };
    }
  }

  // Default fallback
  const defaultCategory = await Category.findOne({
    code: "5140",
    isActive: true,
  });

  return {
    category: "5140",
    name: defaultCategory ? defaultCategory.name : "Miscellaneous Expenses",
    confidence: 30,
    reason: "Unknown vendor - please select appropriate category",
    alternatives: await getAlternativeCategories("5140", 4),
  };
}

/**
 * Get alternative category suggestions from database
 */
async function getAlternativeCategories(excludeCode, count = 2) {
  const expenseCategories = await Category.find({
    code: /^5/,
    code: { $ne: excludeCode },
    isActive: true,
  })
    .limit(count)
    .sort({ usageCount: -1 });

  return expenseCategories.map((c) => ({
    category: c.code,
    name: c.name,
    confidence: Math.floor(Math.random() * 15) + 25, // 25-40% confidence
  }));
}

module.exports = router;

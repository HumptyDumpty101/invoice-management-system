const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}$/,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: "#3b82f6",
      match: /^#[0-9A-F]{6}$/i,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
categorySchema.index({ isActive: 1, isDefault: 1 });
categorySchema.index({ code: 1 });

// Method to get category type based on code
categorySchema.methods.getCategoryType = function () {
  const firstDigit = this.code.charAt(0);
  const types = {
    1: "Assets",
    2: "Liabilities",
    3: "Equity",
    4: "Revenue",
    5: "Expenses",
  };
  return types[firstDigit] || "Other";
};

// Static method to seed default categories
categorySchema.statics.seedDefaultCategories = async function () {
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

    // Expenses (Most commonly used)
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

  for (const categoryData of defaultCategories) {
    await this.findOneAndUpdate({ code: categoryData.code }, categoryData, {
      upsert: true,
      new: true,
    });
  }

  console.log("Default categories seeded successfully");
};

module.exports = mongoose.model("Category", categorySchema);

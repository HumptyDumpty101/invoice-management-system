const mongoose = require("mongoose");
const Category = require("../models/Category");
require("dotenv").config();

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Seed categories
    console.log("Seeding categories...");
    await Category.seedDefaultCategories();

    const categoryCount = await Category.countDocuments({ isActive: true });
    console.log(`✅ Categories seeded: ${categoryCount} categories available`);

    // Show sample categories
    const sampleCategories = await Category.find({ isActive: true })
      .limit(5)
      .sort({ code: 1 });

    console.log("\nSample categories:");
    sampleCategories.forEach((cat) => {
      console.log(`  ${cat.code} - ${cat.name}`);
    });

    await mongoose.connection.close();
    console.log("\n✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

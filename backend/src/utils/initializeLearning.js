// Script to initialize the learning system from existing invoices
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const VendorMapping = require("../models/VendorMapping");
require("dotenv").config();

async function initializeLearningSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing mappings (optional - comment out to preserve existing data)
    // await VendorMapping.deleteMany({});
    // console.log("Cleared existing vendor mappings");

    // Get all invoices
    const invoices = await Invoice.find({}).sort({ createdAt: 1 });
    console.log(`Found ${invoices.length} invoices to process`);

    let learned = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      // Skip if vendor is unknown or invoice is a duplicate
      if (
        invoice.vendor === "Unknown Vendor" ||
        invoice.isDuplicate ||
        !invoice.category
      ) {
        skipped++;
        continue;
      }

      // Check if this was user corrected (high value for learning)
      const isUserCorrected = invoice.userCorrected || false;

      // Higher confidence if the invoice was reviewed and corrected by user
      const confidenceBoost = isUserCorrected ? 20 : 0;

      // Update the mapping
      await VendorMapping.updateMapping(
        invoice.vendor,
        invoice.category,
        invoice.amount,
        isUserCorrected
      );

      learned++;

      if (learned % 10 === 0) {
        console.log(`Processed ${learned} invoices...`);
      }
    }

    console.log("\n=== Learning System Initialization Complete ===");
    console.log(`Total invoices processed: ${invoices.length}`);
    console.log(`Learned from: ${learned} invoices`);
    console.log(`Skipped: ${skipped} invoices`);

    // Show some statistics
    const mappingStats = await VendorMapping.aggregate([
      {
        $group: {
          _id: "$normalizedVendor",
          categories: { $sum: 1 },
          totalCount: { $sum: "$count" },
          avgConfidence: { $avg: "$confidence" },
        },
      },
      { $sort: { totalCount: -1 } },
      { $limit: 10 },
    ]);

    console.log("\n=== Top 10 Vendors by Transaction Count ===");
    for (const stat of mappingStats) {
      console.log(
        `${stat._id}: ${stat.totalCount} transactions, ${
          stat.categories
        } categories, ${Math.round(stat.avgConfidence)}% avg confidence`
      );
    }

    // Show category distribution
    const categoryStats = await VendorMapping.aggregate([
      {
        $group: {
          _id: "$category",
          vendorCount: { $sum: 1 },
          totalTransactions: { $sum: "$count" },
          avgConfidence: { $avg: "$confidence" },
        },
      },
      { $sort: { totalTransactions: -1 } },
    ]);

    console.log("\n=== Category Distribution ===");
    for (const stat of categoryStats) {
      console.log(
        `Category ${stat._id}: ${stat.vendorCount} vendors, ${
          stat.totalTransactions
        } transactions, ${Math.round(stat.avgConfidence)}% avg confidence`
      );
    }

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error initializing learning system:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeLearningSystem();
}

module.exports = { initializeLearningSystem };

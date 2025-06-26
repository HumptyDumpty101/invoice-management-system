// Test script to verify the prediction system
const mongoose = require("mongoose");
const VendorMapping = require("../models/VendorMapping");
require("dotenv").config();

async function testPrediction(vendorName, amount = 10) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    console.log(`\nTesting prediction for: ${vendorName} ($${amount})`);

    const prediction = await VendorMapping.predictCategory(vendorName, amount);

    if (prediction) {
      console.log("\n=== Prediction Result ===");
      console.log(`Category: ${prediction.category}`);
      console.log(`Confidence: ${prediction.confidence}%`);
      console.log(`Reason: ${prediction.reason}`);
      console.log(`Score: ${prediction.score}`);

      if (prediction.alternatives && prediction.alternatives.length > 0) {
        console.log("\nAlternatives:");
        prediction.alternatives.forEach((alt, i) => {
          console.log(
            `  ${i + 1}. Category ${alt.category} (${alt.confidence}%)`
          );
        });
      }
    } else {
      console.log("No prediction found - this is a new vendor");
    }

    // Show all mappings for this vendor
    const normalizedVendor = vendorName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const allMappings = await VendorMapping.find({ normalizedVendor }).sort({
      confidence: -1,
      count: -1,
    });

    if (allMappings.length > 0) {
      console.log("\n=== All Mappings for this Vendor ===");
      allMappings.forEach((mapping) => {
        console.log(
          `Category ${mapping.category}: ${mapping.count} uses, ${mapping.confidence}% confidence, ` +
            `avg amount: $${mapping.averageAmount.toFixed(2)}, ` +
            `user corrections: ${mapping.userCorrections}`
        );
      });
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error testing prediction:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const vendor = process.argv[2] || "Midjourney";
  const amount = parseFloat(process.argv[3]) || 10;
  testPrediction(vendor, amount);
}

module.exports = { testPrediction };

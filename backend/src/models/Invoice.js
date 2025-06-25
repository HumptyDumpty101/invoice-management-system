const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    vendor: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    categoryConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    rawText: {
      type: String,
      required: true,
    },
    extractedData: {
      lineItems: [
        {
          description: String,
          amount: Number,
          quantity: Number,
        },
      ],
      tax: Number,
      subtotal: Number,
      currency: {
        type: String,
        default: "USD",
      },
    },
    validationStatus: {
      dateValid: {
        type: Boolean,
        default: false,
      },
      amountValid: {
        type: Boolean,
        default: false,
      },
      vendorValid: {
        type: Boolean,
        default: false,
      },
      overallConfidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      issues: [String],
      needsReview: {
        type: Boolean,
        default: false,
      },
    },
    fileMetadata: {
      originalName: {
        type: String,
        required: true,
      },
      fileName: {
        type: String,
        required: true,
      },
      fileType: {
        type: String,
        required: true,
        enum: ["pdf", "jpg", "jpeg", "png"],
      },
      fileSize: {
        type: Number,
        required: true,
      },
      pageCount: {
        type: Number,
        default: 1,
      },
      ocrConfidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    processingMetadata: {
      extractionMethod: {
        type: String,
        enum: ["pdf", "ocr"],
        required: true,
      },
      processingTime: {
        type: Number,
        default: 0,
      },
      retryCount: {
        type: Number,
        default: 0,
      },
      version: {
        type: String,
        default: "1.0",
      },
    },
    userCorrected: {
      type: Boolean,
      default: false,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
invoiceSchema.index({ vendor: 1, date: -1 });
invoiceSchema.index({ category: 1, date: -1 });
invoiceSchema.index({ "validationStatus.needsReview": 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtuals for formatted data
invoiceSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString("en-US");
});
invoiceSchema.virtual("formattedAmount").get(function () {
  return `$${this.amount.toFixed(2)}`;
});

// Method to check if invoice needs review
invoiceSchema.methods.requiresReview = function () {
  return (
    this.validationStatus.needsReview ||
    this.validationStatus.overallConfidence < 70 ||
    this.validationStatus.issues.length > 0
  );
};

// Static method to find duplicates
invoiceSchema.statics.findPotentialDuplicates = function (
  vendor,
  amount,
  date
) {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  return this.find({
    vendor: { $regex: vendor, $options: "i" },
    amount: { $gte: amount * 0.95, $lte: amount * 1.05 },
    date: { $gte: startDate, $lte: endDate },
    isDuplicate: false,
  });
};

module.exports = mongoose.model("Invoice", invoiceSchema);

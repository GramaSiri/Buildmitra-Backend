const mongoose = require("mongoose");

const MarketRateSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    subCategory: { type: String, default: "", trim: true },
    specification: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    rateScope: { type: String, default: "", trim: true },
    rateType: { type: String, default: "market", trim: true },

    currentRate: { type: Number, required: true, default: 0 },
    previousRate: { type: Number, default: 0 },

    unit: { type: String, required: true, trim: true },
    city: { type: String, default: "Bengaluru", trim: true, index: true },
    state: { type: String, default: "Karnataka", trim: true },
    pincode: { type: String, default: "", trim: true },

    sourceType: {
      type: String,
      enum: ["external_api", "admin_manual", "provider_upload"],
      default: "admin_manual",
      index: true
    },
    sourceName: { type: String, default: "BuildMitra Approved", trim: true },
    sourceReference: { type: String, default: "", trim: true },

    approvalStatus: {
      type: String,
      enum: ["pending_admin", "approved", "rejected"],
      default: "approved",
      index: true
    },
    isActive: { type: Boolean, default: true },
    approvedBy: { type: String, default: "Admin", trim: true },
    approvedAt: Date,
    effectiveDate: { type: String, default: () => new Date().toISOString().split("T")[0] }
  },
  { timestamps: true, collection: "marketRates" }
);

module.exports = mongoose.models.MarketRate || mongoose.model("MarketRate", MarketRateSchema);

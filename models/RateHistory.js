const mongoose = require("mongoose");

const RateHistorySchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, default: "", trim: true },
    rateType: { type: String, default: "market", trim: true },

    rate: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },

    city: { type: String, default: "Bengaluru", trim: true },
    state: { type: String, default: "Karnataka", trim: true },
    pincode: { type: String, default: "", trim: true },

    sourceType: { type: String, default: "admin_manual" },
    sourceName: { type: String, default: "BuildMitra Historical" },
    effectiveDate: { type: String, default: () => new Date().toISOString().split("T")[0] }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "rateHistories" }
);

module.exports = mongoose.models.RateHistory || mongoose.model("RateHistory", RateHistorySchema);

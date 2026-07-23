const mongoose = require("mongoose");

const RateHistorySchema = new mongoose.Schema(
  {
    snapshotDate: { type: String, required: true, index: true }, // YYYY-MM-DD
    itemCode: { type: String, required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, default: "", trim: true },
    specification: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    rateScope: { type: String, default: "", trim: true },

    currentRate: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    city: { type: String, default: "Bengaluru", trim: true, index: true },

    sourceType: { type: String, enum: ["marketplace", "admin"], default: "admin" },
    sourceLabel: { type: String, default: "BuildMitra Admin Approved Rate" },
    sourceRecordId: { type: String, default: "" },

    providerCount: { type: Number, default: 0 },
    minimumRate: { type: Number, default: 0 },
    maximumRate: { type: Number, default: 0 },
    averageRate: { type: Number, default: 0 }
  },
  { timestamps: true, collection: "rateHistories" }
);

// Target 3: Unique index to prevent duplicate daily records for same item, location, specification, unit, rateScope
RateHistorySchema.index(
  { snapshotDate: 1, city: 1, itemCode: 1, specification: 1, unit: 1, rateScope: 1 },
  { unique: true }
);

module.exports = mongoose.models.RateHistory || mongoose.model("RateHistory", RateHistorySchema);

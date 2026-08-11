const mongoose = require("mongoose");

const MarketRateSchema = new mongoose.Schema(
  {
    masterItemCode: { type: String, trim: true, index: true },
    itemCode: { type: String, required: true, trim: true, index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    itemType: { type: String, default: "material", trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    subCategory: { type: String, default: "", trim: true },
    specification: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    rateScope: { type: String, default: "", trim: true },
    rateType: { type: String, default: "market", trim: true },

    currentRate: { type: Number, required: true, default: 0 },
    previousRate: { type: Number, default: 0 },

    unit: { type: String, required: true, trim: true },
    gst: { type: Number, default: 0 },
    city: { type: String, default: "Bengaluru", trim: true, index: true },
    state: { type: String, default: "Karnataka", trim: true },
    pincode: { type: String, default: "", trim: true },
    region: { type: String, default: "Bengaluru", trim: true },

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
    primaryMasterItemCode: { type: String, default: "", trim: true, index: true },
    linkedLabourItemCode: { type: String, default: "", trim: true, index: true },
    rateComponent: { type: String, enum: ["primary", "labour", ""], default: "primary", index: true },
    isActive: { type: Boolean, default: true, index: true },
    approvedBy: { type: String, default: "Admin", trim: true },
    approvedAt: Date,
    effectiveDate: { type: String, default: () => new Date().toISOString().split("T")[0] },
    remarks: { type: String, default: "" }
  },
  { timestamps: true, collection: "marketRates" }
);

MarketRateSchema.index({ itemCode: 1, city: 1, unit: 1 });
MarketRateSchema.index({ masterItemCode: 1, city: 1 });

module.exports = mongoose.models.MarketRate || mongoose.model("MarketRate", MarketRateSchema);

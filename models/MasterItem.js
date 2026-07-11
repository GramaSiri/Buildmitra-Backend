const mongoose = require("mongoose");

const MasterItemSchema = new mongoose.Schema(
  {
    masterItemCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    itemType: {
      type: String,
      enum: ["material", "service", "labour", "machine", "vendor"],
      required: true,
      index: true,
    },
    category: { type: String, default: "", index: true },
    subCategory: { type: String, default: "", index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    brand: { type: String, default: "", index: true },
    specification: { type: String, default: "" },
    unit: { type: String, default: "" },
    gst: { type: Number, default: 0 },
    hsnCode: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    referenceRate: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: String, default: "admin" },
    updatedBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

MasterItemSchema.index(
  { itemType: 1, itemName: 1, brand: 1, specification: 1, unit: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
MasterItemSchema.index({ itemName: "text", brand: "text", category: "text", masterItemCode: "text" });

module.exports = mongoose.model("MasterItem", MasterItemSchema);

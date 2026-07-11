const mongoose = require("mongoose");

const NewItemRequestSchema = new mongoose.Schema(
  {
    requestCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    proposedItemName: { type: String, required: true, trim: true },
    itemType: {
      type: String,
      enum: ["material", "service", "labour", "machine", "vendor"],
      default: "material",
      index: true,
    },
    brand: { type: String, default: "" },
    specification: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    remarks: { type: String, default: "" },
    providerUserCode: { type: String, required: true, index: true },
    providerRole: { type: String, default: "" },
    providerName: { type: String, default: "" },
    providerPhone: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    assignedMasterItemCode: { type: String, default: "" },
    adminRemarks: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NewItemRequest", NewItemRequestSchema);

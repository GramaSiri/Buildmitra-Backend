const mongoose = require("mongoose");

const MarketplaceListingSchema = new mongoose.Schema(
  {
    listingCode: { type: String, unique: true, sparse: true },

    masterItemCode: { type: String, required: true, index: true, uppercase: true },
    masterItem: { type: mongoose.Schema.Types.ObjectId, ref: "MasterItem" },

    itemType: {
      type: String,
      enum: ["material", "service", "machine", "labour", "vendor"],
      required: true,
      index: true,
    },

    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },

    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    itemName: { type: String, required: true },
    brand: { type: String, default: "" },
    specification: { type: String, default: "" },
    description: { type: String, default: "" },

    unit: { type: String, default: "" },
    rate: { type: Number, default: 0 },
    approvedRate: { type: Number, default: 0 },
    proposedRate: { type: Number, default: 0 },
    availability: { type: String, enum: ["In Stock", "Out of Stock", "Limited Stock"], default: "In Stock" },
    providerStock: { type: Number, default: 0 },
    minOrderQty: { type: Number, default: 1 },
    deliveryTime: { type: String, default: "" },
    deliveryArea: { type: String, default: "" },
    transport: { type: String, default: "" },
    remarks: { type: String, default: "" },
    gst: { type: Number, default: 0 },
    hsnCode: { type: String, default: "" },

    providerUserCode: { type: String, required: true },
    providerRole: {
      type: String,
      enum: ["supplier", "contractor", "vendor", "machinehire", "laboursupply"],
      required: true,
    },
    providerName: { type: String, required: true },
    providerPhone: { type: String, default: "" },
    providerAddress: { type: String, default: "" },
    providerCity: { type: String, default: "" },
    providerArea: { type: String, default: "" },
    providerPincode: { type: String, default: "" },

    location: { type: String, default: "" },
    pincode: { type: String, default: "" },
    serviceArea: { type: String, default: "" },

    imageUrl: { type: String, default: "" },
    documentUrl: { type: String, default: "" },

    images: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
        uploadDate: { type: Date, default: Date.now },
        uploadedBy: { type: String, default: "" },
        isActive: { type: Boolean, default: true }
      }
    ],

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },

    submittedBy: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date },
    rejectedReason: { type: String, default: "" },
    version: { type: Number, default: 1 },
    previousListing: { type: mongoose.Schema.Types.ObjectId, ref: "MarketplaceListing" },
  },
  { timestamps: true }
);

MarketplaceListingSchema.index({ providerUserCode: 1, masterItemCode: 1 }, { unique: true, partialFilterExpression: { isArchived: false } });
MarketplaceListingSchema.index({ masterItemCode: 1, providerUserCode: 1, status: 1 });
MarketplaceListingSchema.index({ status: 1, isActive: 1, isBlocked: 1, itemType: 1, category: 1 });
MarketplaceListingSchema.index({ itemName: "text", brand: "text", category: "text", providerName: "text", providerCity: "text", location: "text" });

module.exports = mongoose.model("MarketplaceListing", MarketplaceListingSchema);

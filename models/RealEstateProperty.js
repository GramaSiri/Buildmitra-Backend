const mongoose = require("mongoose");

const RealEstatePropertySchema = new mongoose.Schema(
  {
    propertyCode: {
      type: String,
      unique: true,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    providerUserCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    providerRole: {
      type: String,
      default: "realestate",
      trim: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    providerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    providerEmail: {
      type: String,
      default: "",
      trim: true,
    },

    transactionType: {
      type: String,
      enum: ["sale", "rent", "lease", "buy-requirement", "rent-requirement"],
      required: true,
      index: true,
    },

    propertyType: {
      type: String,
      enum: [
        "plot",
        "apartment",
        "villa",
        "house",
        "commercial",
        "industrial",
        "agriculture",
        "farm-land",
        "revenue-land",
        "bmrda",
        "other"
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    landmark: {
      type: String,
      default: "",
      trim: true,
    },

    plotArea: { type: Number, default: 0 },
    builtUpArea: { type: Number, default: 0 },
    areaUnit: { type: String, default: "sqft" },

    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    balconies: { type: Number, default: 0 },
    floors: { type: Number, default: 0 },
    propertyAge: { type: String, default: "" },
    facing: { type: String, default: "" },
    furnishing: { type: String, default: "" },
    parking: { type: String, default: "" },

    askingPrice: { type: Number, default: 0 },
    monthlyRent: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    ratePerSqft: { type: Number, default: 0 },
    negotiable: { type: Boolean, default: false },

    amenities: [{ type: String }],
    imageUrls: [{ type: String }],
    videoUrls: [{ type: String }],
    documentUrls: [{ type: String }],

    verificationStatus: {
      type: String,
      enum: ["not-submitted", "submitted", "verified", "failed"],
      default: "not-submitted",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "sold",
        "rented",
        "inactive"
      ],
      default: "pending",
      index: true,
    },

    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    submittedBy: { type: String, default: "" },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Date },
    rejectedReason: { type: String, default: "" },

    views: { type: Number, default: 0 },
    enquiryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RealEstatePropertySchema.index({
  status: 1,
  isActive: 1,
  isBlocked: 1,
  transactionType: 1,
  propertyType: 1,
  city: 1,
});

RealEstatePropertySchema.index({
  title: "text",
  description: "text",
  city: "text",
  area: "text",
  providerName: "text",
});

module.exports = mongoose.model(
  "RealEstateProperty",
  RealEstatePropertySchema
);

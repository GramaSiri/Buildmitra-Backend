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
      enum: ["sale", "rent", "lease", "buy-requirement", "rent-requirement", "Sale", "Rent"],
      default: "sale",
      index: true,
    },
    listingType: {
      type: String,
      default: "Sale",
      index: true,
    },

    propertyType: {
      type: String,
      default: "plot",
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
    locality: {
      type: String,
      default: "",
      trim: true,
    },
    area: {
      type: mongoose.Schema.Types.Mixed,
      default: 0,
    },
    state: {
      type: String,
      default: "Karnataka",
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
    latitude: { type: Number },
    longitude: { type: Number },

    // Size / Area
    plotArea: { type: Number, default: 0 },
    builtUpArea: { type: Number, default: 0 },
    superBuiltUpArea: { type: Number, default: 0 },
    totalArea: { type: Number, default: 0 },
    areaValue: { type: Number, default: 0 },
    areaUnit: { type: String, default: "sqft" },

    // Room Specs
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    balconies: { type: Number, default: 0 },
    floorNumber: { type: Number, default: 0 },
    floors: { type: Number, default: 0 },
    totalFloors: { type: Number, default: 0 },
    propertyAge: { type: String, default: "" },
    possessionStatus: { type: String, default: "Ready to Move" },
    facing: { type: String, default: "" },
    furnishing: { type: String, default: "" },
    parking: { type: String, default: "" },
    approvalType: { type: String, default: "" },

    // Pricing
    askingPrice: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    monthlyRent: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    ratePerSqft: { type: Number, default: 0 },
    pricePerSqft: { type: Number, default: 0 },
    negotiable: { type: Boolean, default: false },

    amenities: [{ type: String }],
    
    // Media references (Max 3 Images, Max 1 Video, Max 5 Documents)
    images: [{ type: String }],
    imageUrls: [{ type: String }],
    coverImage: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    
    videoUrl: { type: String, default: "" },
    videoUrls: [{ type: String }],
    
    documents: [mongoose.Schema.Types.Mixed],
    documentUrls: [{ type: String }],

    verificationStatus: {
      type: String,
      enum: ["not-submitted", "submitted", "verified", "failed"],
      default: "not-submitted",
    },

    status: {
      type: String,
      default: "Available",
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "pending", "approved", "rejected"],
      default: "Approved",
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

    // Backward compatibility legacy aliases
    ownerUserCode: { type: String, default: "" },
    agentCode: { type: String, default: "" },
    category: { type: String, default: "" },
    purpose: { type: String, default: "" },
  },
  { timestamps: true, strict: false }
);

RealEstatePropertySchema.index({
  status: 1,
  approvalStatus: 1,
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
  locality: "text",
  providerName: "text",
});

module.exports = mongoose.model(
  "RealEstateProperty",
  RealEstatePropertySchema
);

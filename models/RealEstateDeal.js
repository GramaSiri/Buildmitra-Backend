const mongoose = require("mongoose");

const RealEstateDealSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    dealId: { type: String, required: true, index: true },
    propertyId: { type: String, default: "" },
    propertyTitle: { type: String, default: "" },
    buyerName: { type: String, default: "" },
    finalPriceCr: { type: Number, default: 0 },
    commissionEarnedLakhs: { type: Number, default: 0 },
    closedDate: { type: String, default: "" },
    sroOffice: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RealEstateDeal", RealEstateDealSchema);

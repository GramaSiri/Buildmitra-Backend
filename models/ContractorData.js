const mongoose = require("mongoose");

const ContractorDataSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, unique: true, index: true },
    companyProfile: { type: Object, default: {} },
    customLocations: { type: Array, default: [] },
    quotes: { type: Array, default: [] },
    companyDocs: { type: Array, default: [] },
    labourMasterList: { type: Array, default: [] }
  },
  { strict: false, timestamps: true }
);

module.exports = mongoose.model("ContractorData", ContractorDataSchema);

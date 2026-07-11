const mongoose = require("mongoose");

const MasterMaterialSchema = new mongoose.Schema({
  material_code: { type: String, unique: true, sparse: true },
  masterCode: { type: String, unique: true, sparse: true },

  product_name: { type: String, required: true },
  itemName: { type: String },

  category: { type: String, default: "General" },
  subcategory: { type: String, default: "" },
  brand: { type: String, default: "" },
  specification: { type: String, default: "" },
  unit: { type: String, default: "" },

  rate: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  min_order: { type: Number, default: 0 },

  image: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  description: { type: String, default: "" },
  status: { type: String, default: "Active" }
}, { timestamps: true });

module.exports = mongoose.models.MasterMaterial || mongoose.model("MasterMaterial", MasterMaterialSchema);

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  masterCode: { type: String, unique: true, required: true },
  legacyCode: String,
  category: String,
  subCategory: String,
  brand: String,
  itemName: String,
  specification: String,
  unit: String,
  basePrice: Number,
  gst: Number,
  hsnCode: String,
  imageFileName: String,
  imagePath: String,
  imageAltText: String,
  searchKeywords: String,
  status: { type: String, default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
// models/Vendor.js

import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  vendorName: { type: String, required: true },
  tradeType: { type: String, required: true },
  materials: { type: String },
  ratePerUnit: { type: String },
  servicePincodes: { type: String },
  contactNumber: { type: String },
  imageUrl: { type: String }
});

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor;
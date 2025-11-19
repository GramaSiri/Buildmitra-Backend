import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  category: { type: String, required: true }, // e.g., Cement, Steel, Aggregates
  unit: { type: String, required: true },     // e.g., kg, bag, sqft
  rate: { type: Number, required: true },     // ₹ per unit
  vendorName: { type: String },
  contactNumber: { type: String },
  servicePincodes: { type: String },
  imageUrl: { type: String }
});

export default mongoose.model('Material', materialSchema);
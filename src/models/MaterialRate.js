import mongoose from 'mongoose';

const MaterialRateSchema = new mongoose.Schema({
  material: { type: String, required: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  unit: { type: String, required: true },
  standardRate: { type: Number, required: true },
  luxuryRate: { type: Number, required: true },
  ultraRate: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('MaterialRate', MaterialRateSchema);

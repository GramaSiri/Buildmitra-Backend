import mongoose, { Schema, Document } from 'mongoose';

export interface IRate extends Document {
  material: string;
  category: string;
  subcategory: string;
  unit: string;
  price: number;
  quality: 'standard' | 'luxury' | 'ultra';
  region: string;
  lastUpdated: Date;
}

const RateSchema = new Schema({
  material: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  unit: { type: String, required: true },
  price: { type: Number, required: true },
  quality: { type: String, enum: ['standard', 'luxury', 'ultra'], default: 'standard' },
  region: { type: String, default: 'default' },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

RateSchema.index({ material: 1, category: 1, quality: 1 });

export default mongoose.model<IRate>('Rate', RateSchema);

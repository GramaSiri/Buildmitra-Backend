import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description: string;
  client: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'ongoing' | 'completed';
  totalBudget: number;
}

const ProjectSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  client: { type: String },
  location: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['planning', 'ongoing', 'completed'], default: 'planning' },
  totalBudget: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IProject>('Project', ProjectSchema);

import mongoose from 'mongoose';

const labourSchema = new mongoose.Schema({
  labourName: { type: String, required: true },
  skillType: { type: String, required: true },
  experienceYears: { type: Number, required: true },
  servicePincodes: { type: String, required: true },
  contactNumber: { type: String, required: true },
  imageUrl: { type: String }
});

export default mongoose.model('Labour', labourSchema);
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }, // Controls export access
  role: { type: String, default: 'user' },    // Optional: 'admin', 'vendor', etc.
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
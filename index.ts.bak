import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: 'BuildMitra API is working!' });
});

app.get('/api/rates', (req, res) => {
  res.json([
    { id: 1, name: 'Cement', unit: 'bag', price: 380 },
    { id: 2, name: 'Sand', unit: 'm³', price: 1500 },
    { id: 3, name: 'Brick', unit: '1000 pcs', price: 6000 }
  ]);
});

mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Starting server without MongoDB (mock mode)');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT} (no DB)`));
  });
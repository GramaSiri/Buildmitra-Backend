import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import contractorRoutes from './routes/contractorRoutes.js';
import labourRoutes from './routes/labourRoutes.js';
import materialRoutes from './routes/materialRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import authRoutes from './routes/authRoutes.js';
import vendorRoutes from './routes/vendor.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Route mounting
app.use('/api/vendor', vendorRoutes);
app.use('/api/vendors', vendorRoutes); // optional alias
app.use('/api/contractors', contractorRoutes);
app.use('/api/labour', labourRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', authRoutes);

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => app.listen(5000, () => console.log('🚀 Server running on port 5000')))
.catch((err) => console.error('❌ MongoDB connection error:', err));
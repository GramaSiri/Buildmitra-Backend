const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://192.168.31.248:3000', 'https://buildmitra-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Serve static images
app.use('/images', express.static('D:/images/Desktop/BMFrontend-2026-07-04/public/images'));

// Serve static images from frontend
app.use(express.urlencoded({ extended: true }));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buildmitra';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Continuing without database...');
  });

// Routes - CONNECT ALL ROUTES
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/certificate', require('./routes/certificate'));
app.use('/api/guidelines', require('./routes/guidelines'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/project-permission', require('./routes/project-permission'));
app.use('/api/enquiry', require('./routes/enquiry'));
app.use('/api/quote', require('./routes/quote'));
app.use('/api/provider', require('./routes/provider'));
app.use('/api/provider-upload', require('./routes/provider-upload'));

app.use('/api/master/materials', require('./routes/master/materials'));
app.use('/api/master/labour', require('./routes/master/labour'));
app.use('/api/master/services', require('./routes/master/services'));
app.use('/api/master/equipment', require('./routes/master/equipment'));

app.use('/api/admin', require('./routes/admin'));
app.use('/api/rates', require('./routes/rates'));

// Product Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/marketplace', require('./routes/marketplace'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    deployment: 'buildmitra-auth-v2', 
    timestamp: new Date().toISOString(),
    message: 'BuildMitra Backend is running!'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'BuildMitra API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      quiz: '/api/quiz/questions',
      leaderboard: '/api/leaderboard',
      certificate: '/api/certificate/generate',
      guidelines: '/api/guidelines',
      auth: '/api/auth/register'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

// Update enquiry endpoint
app.put('/api/enquiry/update/:enquiryCode', async (req, res) => {
  try {
    const Enquiry = require('./models/Enquiry');
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      { $set: req.body },
      { new: true }
    );
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    res.json({ success: true, enquiry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📊 Health Check: http://localhost:' + PORT + '/api/health');
  console.log('📚 Available endpoints:');
  console.log('   - GET  /api/quiz/questions');
  console.log('   - POST /api/quiz/submit');
  console.log('   - GET  /api/leaderboard');
  console.log('   - POST /api/leaderboard/update');
  console.log('   - POST /api/certificate/generate');
  console.log('   - GET  /api/guidelines');
  console.log('   - POST /api/auth/register');
  console.log('   - POST /api/auth/login');
  console.log('   - GET  /api/products');
  console.log('   - GET  /api/products/categories/all');
});

module.exports = app;
// Force redeploy



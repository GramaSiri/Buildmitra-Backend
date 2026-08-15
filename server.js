const labourNetRoutes = require('./routes/labourNet');
const express = require('express');
const securityShield = require('./middleware/securityShield');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
securityShield(app);

// Middleware with 50MB payload limits to handle image uploads and high-res property data
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required. Backend stopped to prevent connection to the wrong database.');
  process.exit(1);
}
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
app.use('/api/realestate', require('./routes/realestate'));
app.use('/api/construction-videos', require('./routes/construction-videos'));
app.use('/api/expert-talks', require('./routes/expert-talks'));
app.use('/api/learn-earn/games', require('./routes/games'));

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
      auth: '/api/auth/register',
      constructionVideos: '/api/construction-videos',
      expertTalks: '/api/expert-talks'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
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

const { startExpertTalkSyncJob } = require('./jobs/expertTalkSyncJob');

const PORT = process.env.PORT || 5000;
app.use('/api/labour-net', labourNetRoutes);


/* BuildMitra Admin Master Images & Rates */
app.use("/api/master-images", require("./routes/masterImages"));


/* BM_DIRECT_MARKETPLACE_IMAGE_ROUTE
   Permanent public delivery of Admin-approved Marketplace GridFS images.
*/
app.get("/api/marketplace/images/:id", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const { GridFSBucket, ObjectId } = require("mongodb");

    if (!mongoose.connection.db) {
      return res.status(503).json({
        success: false,
        message: "Database not ready"
      });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image id"
      });
    }

    const db = mongoose.connection.db;
    const bucketName = "marketplaceImages";
    const bucket = new GridFSBucket(db, { bucketName });
    const objectId = new ObjectId(req.params.id);

    const file = await db
      .collection(`${bucketName}.files`)
      .findOne({ _id: objectId });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Marketplace image not found"
      });
    }

    const contentType =
      file.contentType ||
      file.metadata?.contentType ||
      file.metadata?.mimetype ||
      "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(file.length));
    res.setHeader("Cache-Control", "public, max-age=86400");

    const stream = bucket.openDownloadStream(objectId);

    stream.on("error", (err) => {
      console.error("Marketplace image stream error:", err);

      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: "Marketplace image unavailable"
        });
      } else {
        res.end();
      }
    });

    stream.pipe(res);

  } catch (error) {
    console.error("Marketplace direct image route error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Unable to load marketplace image"
      });
    }
  }
});


/* BM_RENDER_VERIFY_START */
app.get("/api/bm-render-verify", (req, res) => {
  res.status(200).json({
    success: true,
    marker: "BM-LIVE-VERIFY-20260815-183359",
    entrypoint: "server.js",
    marketplaceImageRoute: true
  });
});
/* BM_RENDER_VERIFY_END */
app.listen(PORT, () => {
  console.log(`🚀 BuildMitra Backend running on port ${PORT}`);
  startExpertTalkSyncJob();
});






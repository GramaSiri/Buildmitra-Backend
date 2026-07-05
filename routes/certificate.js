const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const Score = require('../models/Score');

// Generate certificate
router.post('/generate', async (req, res) => {
  try {
    const { userId, userName, score } = req.body;
    if (score !== 100) {
      return res.status(400).json({ success: false, message: 'Certificate only for 100% score' });
    }
    
    const certificateId = 'CERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const certificate = new Certificate({ userId, userName, certificateId, score });
    await certificate.save();
    
    await Score.findOneAndUpdate(
      { userId: userId, score: 100 },
      { certificateId: certificateId, certificateGenerated: true },
      { sort: { date: -1 } }
    );
    
    res.json({ success: true, certificateId: certificateId });
  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get certificate
router.get('/:certificateId', async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    res.json({ success: true, certificate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Download certificate
router.get('/download/:certificateId', async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    res.json({
      success: true,
      message: 'Certificate download ready',
      certificate: {
        id: certificate.certificateId,
        userName: certificate.userName,
        date: certificate.date,
        score: certificate.score
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Score = require('../models/Score');

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const scores = await Score.find()
      .sort({ score: -1, date: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email');
    
    const formatted = scores.map((s, index) => ({
      id: s._id,
      userName: s.userName || (s.userId ? s.userId.name : 'Guest'),
      score: s.score,
      date: s.date,
      certificateId: s.certificateId,
      rank: index + 1
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update score
router.post('/update', async (req, res) => {
  try {
    const { userId, userName, score, certificateId } = req.body;
    const scoreEntry = new Score({
      userId,
      userName,
      score,
      certificateId: score === 100 ? certificateId : null,
      certificateGenerated: score === 100
    });
    await scoreEntry.save();
    res.json({ success: true, scoreId: scoreEntry._id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

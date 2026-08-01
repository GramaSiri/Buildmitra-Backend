const express = require('express');
const router = express.Router();
const GameProgress = require('../models/GameProgress');

// List of all games available in Learn & Earn Hub
const GAME_HUB_LIST = [
  {
    id: 'block-planner',
    name: 'Block Planner Studio',
    category: 'Architecture & Layout Design',
    difficulty: 'Intermediate',
    learningObjective: 'Master 2D & 3D room planning, setbacks, Vastu, circulation, and structural column grid placement.',
    defaultScore: 0,
    icon: 'Apartment'
  },
  {
    id: 'elevation-puzzle',
    name: 'Elevation & Façade Puzzle',
    category: 'Architectural Elevation & Structural Assembly',
    difficulty: 'Beginner to Advanced',
    learningObjective: 'Design exterior building façades and master load-bearing construction sequences from footing to parapet.',
    defaultScore: 0,
    icon: 'ViewQuilt'
  },
  {
    id: 'concrete-master',
    name: 'Concrete Master Lab',
    category: 'Materials & Quality Control',
    difficulty: 'Intermediate',
    learningObjective: 'Design target concrete mix proportions (M5-M40), conduct slump cone tests, and simulate 150mm cube CTM press tests.',
    defaultScore: 0,
    icon: 'Science'
  },
  {
    id: 'beam-master',
    name: 'Beam Master',
    category: 'Structural Mechanics',
    difficulty: 'Advanced',
    learningObjective: 'Analyze point & UDL loads, solve support reactions, and plot real-time SFD, BMD, and elastic deflection curves.',
    defaultScore: 0,
    icon: 'Timeline'
  },
  {
    id: 'building-assembly',
    name: 'Building Assembly Challenge',
    category: 'Construction Management & Sequence',
    difficulty: 'Beginner',
    learningObjective: 'Understand step-by-step residential building execution order under Indian Standard Codes.',
    defaultScore: 0,
    icon: 'Layers'
  }
];

// GET /api/learn-earn/games - Metadata list
router.get('/', (req, res) => {
  res.json({ success: true, games: GAME_HUB_LIST });
});

// GET /api/learn-earn/games/progress?userCode=CON-000100
router.get('/progress', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.json({ success: true, progress: [] });
    }
    const records = await GameProgress.find({ userCode });
    res.json({ success: true, progress: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/learn-earn/games/progress - Save or update level score & badges
router.post('/progress', async (req, res) => {
  try {
    const { userCode, gameId, score = 0, level = 1, stars = 0, badges = [], completion = 0 } = req.body;

    if (!userCode || !gameId) {
      return res.status(400).json({ success: false, message: 'userCode and gameId are required' });
    }

    let record = await GameProgress.findOne({ userCode, gameId });

    if (!record) {
      record = new GameProgress({
        userCode,
        gameId,
        level,
        score,
        bestScore: score,
        attempts: 1,
        completion,
        stars,
        badges,
        lastPlayedAt: new Date()
      });
    } else {
      record.attempts += 1;
      record.score = score;
      if (score > record.bestScore) {
        record.bestScore = score;
      }
      if (level > record.level) {
        record.level = level;
      }
      if (stars > record.stars) {
        record.stars = stars;
      }
      if (completion > record.completion) {
        record.completion = completion;
      }
      // Merge unique badges
      const combinedBadges = Array.from(new Set([...(record.badges || []), ...(badges || [])]));
      record.badges = combinedBadges;
      record.lastPlayedAt = new Date();
    }

    await record.save();
    res.json({ success: true, progress: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/learn-earn/games/designs - Save custom layout JSON
router.post('/designs', async (req, res) => {
  try {
    const { userCode, design } = req.body;

    if (!userCode || !design || !design.id) {
      return res.status(400).json({ success: false, message: 'userCode and valid design object are required' });
    }

    let record = await GameProgress.findOne({ userCode, gameId: 'block-planner' });

    if (!record) {
      record = new GameProgress({
        userCode,
        gameId: 'block-planner',
        savedDesigns: [design]
      });
    } else {
      const existingIdx = record.savedDesigns.findIndex(d => d.id === design.id);
      if (existingIdx >= 0) {
        record.savedDesigns[existingIdx] = { ...design, updatedAt: new Date() };
      } else {
        record.savedDesigns.push(design);
      }
    }

    await record.save();
    res.json({ success: true, savedDesign: design, totalSaved: record.savedDesigns.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/learn-earn/games/designs/:id
router.get('/designs/:id', async (req, res) => {
  try {
    const { userCode } = req.query;
    const { id } = req.params;

    if (!userCode) {
      return res.status(400).json({ success: false, message: 'userCode query param is required' });
    }

    const record = await GameProgress.findOne({ userCode, gameId: 'block-planner' });
    if (!record) {
      return res.status(404).json({ success: false, message: 'No saved designs found for user' });
    }

    const design = record.savedDesigns.find(d => d.id === id);
    if (!design) {
      return res.status(404).json({ success: false, message: 'Design not found' });
    }

    res.json({ success: true, design });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/learn-earn/games/designs/:id
router.delete('/designs/:id', async (req, res) => {
  try {
    const { userCode } = req.query;
    const { id } = req.params;

    if (!userCode) {
      return res.status(400).json({ success: false, message: 'userCode query param is required' });
    }

    const record = await GameProgress.findOne({ userCode, gameId: 'block-planner' });
    if (record) {
      record.savedDesigns = record.savedDesigns.filter(d => d.id !== id);
      await record.save();
    }

    res.json({ success: true, message: 'Design deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const SavedDesignSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  plotWidth: { type: Number, default: 30 },
  plotLength: { type: Number, default: 40 },
  unit: { type: String, default: 'ft' },
  roadSide: { type: String, default: 'North' },
  northDirection: { type: Number, default: 0 },
  numFloors: { type: Number, default: 1 },
  setbackFront: { type: Number, default: 5 },
  setbackRear: { type: Number, default: 3 },
  setbackLeft: { type: Number, default: 3 },
  setbackRight: { type: Number, default: 3 },
  wallThickness: { type: Number, default: 0.75 },
  gridSpacing: { type: Number, default: 1 },
  blocks: { type: Array, default: [] },
  scores: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const GameProgressSchema = new mongoose.Schema({
  userCode: { type: String, required: true, index: true },
  gameId: { type: String, required: true },
  level: { type: Number, default: 1 },
  score: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  completion: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  badges: { type: [String], default: [] },
  savedDesigns: [SavedDesignSchema],
  lastPlayedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

GameProgressSchema.index({ userCode: 1, gameId: 1 }, { unique: true });

module.exports = mongoose.model('GameProgress', GameProgressSchema);

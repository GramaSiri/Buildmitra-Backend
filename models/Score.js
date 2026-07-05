const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  correctAnswers: { type: Number, required: true },
  totalQuestions: { type: Number, default: 20 },
  timeTaken: { type: Number },
  questionsAttempted: { type: [mongoose.Schema.Types.ObjectId] },
  date: { type: Date, default: Date.now },
  certificateId: { type: String, unique: true, sparse: true },
  certificateGenerated: { type: Boolean, default: false }
});

ScoreSchema.index({ score: -1, date: -1 });

module.exports = mongoose.model('Score', ScoreSchema);

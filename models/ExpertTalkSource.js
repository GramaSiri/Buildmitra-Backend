const mongoose = require('mongoose');

const ExpertTalkSourceSchema = new mongoose.Schema({
  sourceName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['Construction Week India', 'Architectural Digest India', 'ET Realty', 'Construction World']
  },
  baseUrl: {
    type: String,
    required: true,
    trim: true
  },
  feedUrl: {
    type: String,
    required: true,
    trim: true
  },
  sourceType: {
    type: String,
    default: 'rss',
    enum: ['rss', 'atom', 'api', 'sitemap']
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  syncIntervalHours: {
    type: Number,
    default: 6,
    min: 1,
    max: 72
  },
  lastSyncAt: {
    type: Date
  },
  lastSuccessfulSyncAt: {
    type: Date
  },
  nextSyncAt: {
    type: Date
  },
  lastError: {
    type: String,
    default: ''
  },
  failureCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ExpertTalkSource || mongoose.model('ExpertTalkSource', ExpertTalkSourceSchema);

const mongoose = require('mongoose');

const ExpertTalkSyncLogSchema = new mongoose.Schema({
  syncCode: {
    type: String,
    required: true,
    unique: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  triggerType: {
    type: String,
    default: 'scheduled',
    enum: ['scheduled', 'manual', 'startup']
  },
  sourcesChecked: {
    type: Number,
    default: 0
  },
  recordsDiscovered: {
    type: Number,
    default: 0
  },
  recordsInserted: {
    type: Number,
    default: 0
  },
  recordsUpdated: {
    type: Number,
    default: 0
  },
  duplicatesSkipped: {
    type: Number,
    default: 0
  },
  invalidLinksSkipped: {
    type: Number,
    default: 0
  },
  errors: [{
    sourceName: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    default: 'in_progress',
    enum: ['in_progress', 'completed', 'failed', 'completed_with_errors']
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ExpertTalkSyncLog || mongoose.model('ExpertTalkSyncLog', ExpertTalkSyncLogSchema);

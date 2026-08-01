const mongoose = require('mongoose');

const ConstructionVideoSchema = new mongoose.Schema({
  stageNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 40,
    index: true
  },
  stageName: {
    type: String,
    required: true,
    trim: true
  },
  videoTitle: {
    type: String,
    required: true,
    trim: true
  },
  youtubeUrl: {
    type: String,
    required: true,
    trim: true
  },
  youtubeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  language: {
    type: String,
    enum: ['Kannada', 'Hindi', 'English'],
    default: 'Kannada',
    required: true,
    index: true
  },
  channelName: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: String,
    default: 'N/A',
    trim: true
  },
  shortDescription: {
    type: String,
    default: '',
    trim: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ConstructionVideo || mongoose.model('ConstructionVideo', ConstructionVideoSchema);

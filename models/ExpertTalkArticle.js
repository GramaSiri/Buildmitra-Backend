const mongoose = require('mongoose');

const ExpertTalkArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  publication: {
    type: String,
    required: true,
    enum: ['Construction Week India', 'Architectural Digest India', 'ET Realty', 'Construction World', 'Other Approved Source'],
    default: 'Construction Week India',
    index: true
  },
  sourceId: {
    type: String,
    trim: true,
    index: true
  },
  canonicalUrl: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  articleUrl: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800',
    trim: true
  },
  summary: {
    type: String,
    default: '',
    trim: true
  },
  speaker: {
    type: String,
    default: 'Industry Expert',
    trim: true,
    index: true
  },
  author: {
    type: String,
    default: 'Editorial Staff',
    trim: true
  },
  publishDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  readTime: {
    type: String,
    default: '4 min read',
    trim: true
  },
  category: {
    type: String,
    default: 'Construction Tech',
    enum: [
      'Construction Tech',
      'Architecture',
      'Civil Engineering',
      'Building Materials',
      'Real Estate & PropTech',
      'RERA & Legal',
      'Sustainability & Green Building',
      'Prefab & Mivan',
      'BIM & AI',
      'Machinery & Equipment',
      'Safety & Quality'
    ],
    index: true
  },
  contentType: {
    type: String,
    default: 'Interview',
    enum: [
      'Interview',
      'Keynote',
      'Expert Opinion',
      'Technology Update',
      'Architecture',
      'Case Study',
      'Market Update',
      'Legal Update',
      'Video Talk',
      'Podcast'
    ],
    index: true
  },
  language: {
    type: String,
    default: 'English',
    enum: ['English', 'Kannada', 'Hindi']
  },
  tags: [{
    type: String,
    trim: true
  }],
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  linkStatus: {
    type: String,
    default: 'active',
    enum: ['active', 'warning', 'broken']
  },
  lastVerifiedAt: {
    type: Date,
    default: Date.now
  },
  firstFetchedAt: {
    type: Date,
    default: Date.now
  },
  lastFetchedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.ExpertTalkArticle || mongoose.model('ExpertTalkArticle', ExpertTalkArticleSchema);

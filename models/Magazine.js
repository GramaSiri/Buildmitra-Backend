const mongoose = require('mongoose');

const MagazineSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  publication: {
    type: String,
    required: true,
    enum: [
      'Construction Week India',
      'Architectural Digest India',
      'ET Realty',
      'Construction World',
      'EPC World',
      'NBM&CW',
      'Other Approved Publication'
    ],
    default: 'Construction Week India',
    index: true
  },
  edition: {
    type: String,
    required: true,
    trim: true
  },
  issueNumber: {
    type: String,
    default: '',
    trim: true
  },
  publishDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  coverImageUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800',
    trim: true
  },
  pdfUrl: {
    type: String,
    required: true,
    trim: true
  },
  readUrl: {
    type: String,
    default: '',
    trim: true
  },
  summary: {
    type: String,
    default: '',
    trim: true
  },
  highlights: {
    type: [String],
    default: []
  },
  category: {
    type: String,
    enum: [
      'All',
      'Civil & Infrastructure',
      'Architecture & Design',
      'Real Estate & Policy',
      'Building Materials & Concrete',
      'Equipment & Machinery',
      'Technology & BIM',
      'Sustainability & Green Building'
    ],
    default: 'Civil & Infrastructure',
    index: true
  },
  pageCount: {
    type: Number,
    default: 84
  },
  fileSize: {
    type: String,
    default: '18 MB'
  },
  language: {
    type: String,
    default: 'English'
  },
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
  downloadCount: {
    type: Number,
    default: 0
  },
  readCount: {
    type: Number,
    default: 0
  },
  publisher: {
    type: String,
    default: 'BuildMitra Media Desk',
    trim: true
  },
  tags: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

MagazineSchema.index({ publication: 1, publishDate: -1 });
MagazineSchema.index({ category: 1, publishDate: -1 });
MagazineSchema.index({ isFeatured: 1, publishDate: -1 });

module.exports = mongoose.models.Magazine || mongoose.model('Magazine', MagazineSchema);


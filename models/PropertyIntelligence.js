const mongoose = require('mongoose');

const PropertyIntelligenceSchema = new mongoose.Schema({
  headline: { type: String, required: true, trim: true, index: true },
  summary: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['BDA', 'GBA', 'Policy & Legal', 'New Launch', 'Price Trend', 'Inventory & Supply', 'Demand & Rental', 'Infrastructure', 'Developer Activity', 'Forecast'],
    default: 'Developer Activity',
    index: true
  },
  authority: { type: String, trim: true, default: '' },
  geography: { type: String, trim: true, default: 'Bengaluru', index: true },
  microMarkets: [{ type: String, trim: true }],
  propertyTypes: [{ type: String, trim: true }],
  whyItMatters: { type: String, trim: true, default: '' },
  watchNext: { type: String, trim: true, default: '' },
  affectedSegments: [{ type: String, trim: true }],
  impactLevel: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium', index: true },
  confidenceLevel: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  evidenceStatus: {
    type: String,
    enum: ['Final Order', 'Approved', 'RERA Registered', 'Tender', 'Proposal', 'Announcement', 'Market Report', 'Media Report'],
    default: 'Media Report'
  },
  sourceName: { type: String, required: true, trim: true },
  sourceUrl: { type: String, required: true, trim: true },
  canonicalUrl: { type: String, required: true, unique: true, index: true, trim: true },
  sourcePublishedAt: { type: Date, default: Date.now, index: true },
  tags: [{ type: String, trim: true }],
  isFeatured: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['draft', 'in_review', 'published', 'rejected', 'archived'], default: 'draft', index: true },
  collectedBy: { type: String, enum: ['automatic', 'admin'], default: 'automatic' },
  reviewedBy: { type: String, trim: true, default: '' },
  reviewRemarks: { type: String, trim: true, default: '' },
  reviewedAt: Date,
  publishedAt: { type: Date, index: true }
}, { timestamps: true });

PropertyIntelligenceSchema.index({ status: 1, impactLevel: 1, publishedAt: -1 });
PropertyIntelligenceSchema.index({ category: 1, geography: 1, sourcePublishedAt: -1 });

module.exports = mongoose.models.PropertyIntelligence || mongoose.model('PropertyIntelligence', PropertyIntelligenceSchema);

const express = require('express');
const router = express.Router();
const PropertyIntelligence = require('../models/PropertyIntelligence');
const { runPropertyIntelligenceSync, isTrustedSourceUrl, decodeEntities } = require('../services/propertyIntelligenceSyncService');
const { isValidExternalUrl } = require('../services/expertTalkSourceAdapters');

function requireAdmin(req, res, next) {
  const role = String(req.headers['x-user-role'] || '').toLowerCase();
  if (role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
}

function buildFilter(query, publicOnly = false) {
  const filter = publicOnly ? { status: 'published' } : {};
  if (query.status && !publicOnly) filter.status = query.status;
  if (query.category && query.category !== 'All') filter.category = query.category;
  if (query.impactLevel && query.impactLevel !== 'All') filter.impactLevel = query.impactLevel;
  if (query.search) {
    const regex = { $regex: String(query.search).slice(0, 100), $options: 'i' };
    filter.$or = [{ headline: regex }, { summary: regex }, { geography: regex }, { microMarkets: regex }, { tags: regex }];
  }
  return filter;
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = buildFilter(req.query, true);
    const [items, total] = await Promise.all([
      PropertyIntelligence.find(filter).sort({ isFeatured: -1, impactLevel: 1, publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PropertyIntelligence.countDocuments(filter)
    ]);
    res.json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const filter = buildFilter(req.query, false);
    const items = await PropertyIntelligence.find(filter).sort({ createdAt: -1 }).limit(250).lean();
    const counts = await PropertyIntelligence.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ success: true, items, counts: Object.fromEntries(counts.map(x => [x._id, x.count])) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin/sync', requireAdmin, async (req, res) => {
  try {
    const result = await runPropertyIntelligenceSync('manual');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/cleanup-untrusted', requireAdmin, async (req, res) => {
  try {
    const badDrafts = await PropertyIntelligence.find({ status: { $in: ['draft', 'in_review', 'rejected'] } }, { _id: 1, sourceUrl: 1, summary: 1 }).lean();
    const ids = badDrafts.filter(item => !isTrustedSourceUrl(item.sourceUrl) || /&lt;|<a\b|target=|href=/i.test(item.summary || '')).map(item => item._id);
    const result = ids.length ? await PropertyIntelligence.deleteMany({ _id: { $in: ids } }) : { deletedCount: 0 };
    res.json({ success: true, removed: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/admin', requireAdmin, async (req, res) => {
  try {
    if (!req.body.headline || !req.body.summary || !req.body.sourceName || !isValidExternalUrl(req.body.sourceUrl)) {
      return res.status(400).json({ success: false, message: 'Headline, summary, source name and a valid source URL are required.' });
    }
    const canonicalUrl = String(req.body.sourceUrl).trim().split('?')[0];
    if (!isTrustedSourceUrl(req.body.sourceUrl)) {
      return res.status(400).json({ success: false, message: 'Use an official authority, court, established publisher, or recognized market-research source URL.' });
    }
    const item = await PropertyIntelligence.create({ ...req.body, headline: decodeEntities(req.body.headline), summary: decodeEntities(req.body.summary), canonicalUrl, status: 'draft', collectedBy: 'admin' });
    res.status(201).json({ success: true, item });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.code === 11000 ? 'This source is already in the review queue.' : error.message });
  }
});

router.put('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const blocked = ['status', 'publishedAt', 'reviewedAt', 'reviewedBy'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => !blocked.includes(key)));
    if (update.sourceUrl && !isValidExternalUrl(update.sourceUrl)) return res.status(400).json({ success: false, message: 'Invalid source URL' });
    if (update.sourceUrl) update.canonicalUrl = String(update.sourceUrl).trim().split('?')[0];
    const item = await PropertyIntelligence.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/admin/:id/status', requireAdmin, async (req, res) => {
  try {
    const nextStatus = String(req.body.status || '');
    if (!['draft', 'in_review', 'published', 'rejected', 'archived'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const item = await PropertyIntelligence.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (nextStatus === 'published') {
      if (!item.whyItMatters || !item.watchNext) return res.status(400).json({ success: false, message: 'Complete Why it matters and Watch next before publishing.' });
      if (!isTrustedSourceUrl(item.sourceUrl)) return res.status(400).json({ success: false, message: 'Replace the discovery/redirect link with a trusted original source before publishing.' });
      if (/&lt;|<a\b|target=|href=/i.test(item.summary || '')) return res.status(400).json({ success: false, message: 'Clean the encoded HTML from the summary before publishing.' });
      item.publishedAt = new Date();
    }
    item.status = nextStatus;
    item.reviewedBy = String(req.headers['x-user-code'] || 'admin');
    item.reviewRemarks = String(req.body.reviewRemarks || item.reviewRemarks || '');
    item.reviewedAt = new Date();
    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

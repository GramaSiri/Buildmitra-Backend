const express = require('express');
const router = express.Router();
const ExpertTalkArticle = require('../models/ExpertTalkArticle');
const ExpertTalkSource = require('../models/ExpertTalkSource');
const ExpertTalkSyncLog = require('../models/ExpertTalkSyncLog');
const { runExpertTalksSync, initializeDefaultSources, seedInitialArticlesIfEmpty } = require('../services/expertTalkSyncService');
const { isValidExternalUrl } = require('../services/expertTalkSourceAdapters');

// GET all articles with rich filtering, pagination & sorting
router.get('/', async (req, res) => {
  try {
    const {
      publication,
      category,
      contentType,
      speaker,
      language,
      fromDate,
      toDate,
      search,
      featured,
      page = 1,
      limit = 20,
      sort
    } = req.query;

    const filter = { isActive: true };

    if (publication && publication !== 'All') filter.publication = publication;
    if (category && category !== 'All') filter.category = category;
    if (contentType && contentType !== 'All') filter.contentType = contentType;
    if (speaker) filter.speaker = { $regex: speaker, $options: 'i' };
    if (language && language !== 'All') filter.language = language;
    if (featured === 'true' || featured === true) filter.isFeatured = true;

    if (fromDate || toDate) {
      filter.publishDate = {};
      if (fromDate) filter.publishDate.$gte = new Date(fromDate);
      if (toDate) filter.publishDate.$lte = new Date(toDate);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { speaker: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let sortOption = { isFeatured: -1, publishDate: -1, createdAt: -1 };
    if (sort === 'latest') {
      sortOption = { publishDate: -1, createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { publishDate: 1, createdAt: 1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const [articles, totalCount, totalFeatured] = await Promise.all([
      ExpertTalkArticle.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum),
      ExpertTalkArticle.countDocuments(filter),
      ExpertTalkArticle.countDocuments({ isFeatured: true, isActive: true })
    ]);

    // Active publications count
    const activePublicationsCount = await ExpertTalkArticle.distinct('publication', { isActive: true });

    // Articles published today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const articlesTodayCount = await ExpertTalkArticle.countDocuments({
      createdAt: { $gte: startOfToday },
      isActive: true
    });

    // Last successful sync log
    const lastLog = await ExpertTalkSyncLog.findOne({ status: { $in: ['completed', 'completed_with_errors'] } })
      .sort({ completedAt: -1 });

    res.json({
      success: true,
      count: articles.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      stats: {
        totalFeatured,
        articlesTodayCount,
        activePublicationsCount: activePublicationsCount.length,
        lastSuccessfulSyncAt: lastLog ? lastLog.completedAt : new Date()
      },
      articles
    });
  } catch (error) {
    console.error('Error fetching expert talk articles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET list of publication sources & health
router.get('/sources', async (req, res) => {
  try {
    await initializeDefaultSources();
    const sources = await ExpertTalkSource.find().sort({ createdAt: 1 });
    res.json({ success: true, count: sources.length, sources });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET recent sync logs
router.get('/sync-logs', async (req, res) => {
  try {
    const logs = await ExpertTalkSyncLog.find().sort({ startedAt: -1 }).limit(15);
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single article by ID
router.get('/:id', async (req, res) => {
  try {
    const article = await ExpertTalkArticle.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST trigger manual sync ("Sync Now")
router.post('/sync', async (req, res) => {
  try {
    const result = await runExpertTalksSync('manual');
    res.json({
      success: true,
      message: 'Expert talks sync executed successfully',
      result
    });
  } catch (error) {
    console.error('Manual sync failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST add manual article (Admin / Trusted source)
router.post('/', async (req, res) => {
  try {
    const {
      title,
      publication,
      articleUrl,
      imageUrl,
      summary,
      speaker,
      author,
      publishDate,
      readTime,
      category,
      contentType,
      language,
      isFeatured,
      isActive
    } = req.body;

    if (!title || !articleUrl) {
      return res.status(400).json({ success: false, message: 'Title and Article URL are required.' });
    }

    if (!isValidExternalUrl(articleUrl)) {
      return res.status(400).json({ success: false, message: 'Invalid or unsafe Article URL.' });
    }

    const canonicalUrl = articleUrl.trim().split('?')[0];

    const existing = await ExpertTalkArticle.findOne({ canonicalUrl });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An article with this URL already exists.' });
    }

    const article = new ExpertTalkArticle({
      title: title.trim(),
      publication: publication || 'Other Approved Source',
      canonicalUrl,
      articleUrl: articleUrl.trim(),
      imageUrl: imageUrl && isValidExternalUrl(imageUrl) ? imageUrl.trim() : undefined,
      summary: summary ? summary.trim() : title.trim(),
      speaker: speaker ? speaker.trim() : 'Industry Leader',
      author: author ? author.trim() : 'BuildMitra Editorial',
      publishDate: publishDate ? new Date(publishDate) : new Date(),
      readTime: readTime || '5 min read',
      category: category || 'Construction Tech',
      contentType: contentType || 'Interview',
      language: language || 'English',
      isFeatured: isFeatured !== undefined ? isFeatured : false,
      isActive: isActive !== undefined ? isActive : true
    });

    await article.save();

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      article
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create or update source
router.post('/sources', async (req, res) => {
  try {
    const { sourceName, baseUrl, feedUrl, sourceType, syncIntervalHours } = req.body;
    if (!sourceName || !baseUrl || !feedUrl) {
      return res.status(400).json({ success: false, message: 'sourceName, baseUrl, and feedUrl are required' });
    }

    let source = await ExpertTalkSource.findOne({ sourceName });
    if (source) {
      source.baseUrl = baseUrl;
      source.feedUrl = feedUrl;
      if (sourceType) source.sourceType = sourceType;
      if (syncIntervalHours) source.syncIntervalHours = Number(syncIntervalHours);
      await source.save();
    } else {
      source = await ExpertTalkSource.create({
        sourceName,
        baseUrl,
        feedUrl,
        sourceType: sourceType || 'rss',
        syncIntervalHours: syncIntervalHours ? Number(syncIntervalHours) : 6
      });
    }

    res.json({ success: true, message: 'Source configured successfully', source });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update article
router.put('/:id', async (req, res) => {
  try {
    const updated = await ExpertTalkArticle.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, message: 'Article updated successfully', article: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update source settings
router.put('/sources/:id', async (req, res) => {
  try {
    const updated = await ExpertTalkSource.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Source not found' });
    }
    res.json({ success: true, message: 'Source updated successfully', source: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE article
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ExpertTalkArticle.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

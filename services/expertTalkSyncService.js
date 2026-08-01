const ExpertTalkArticle = require('../models/ExpertTalkArticle');
const ExpertTalkSource = require('../models/ExpertTalkSource');
const ExpertTalkSyncLog = require('../models/ExpertTalkSyncLog');
const { fetchFeedData, parseRssFeed, SOURCE_FALLBACK_IMAGES } = require('./expertTalkSourceAdapters');

// Initial Curated Real Expert Talks & Tycoon Interviews Data to seed if feed fails or on first launch
const INITIAL_CURATED_ARTICLES = [
  {
    title: 'Designing Sustainable High-Rises & Green Concrete Systems for Megacities',
    publication: 'Architectural Digest India',
    canonicalUrl: 'https://www.architecturaldigest.in/story/sustainable-high-rise-design-dr-hafeez-contractor/',
    articleUrl: 'https://www.architecturaldigest.in/story/sustainable-high-rise-design-dr-hafeez-contractor/',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    summary: 'Dr. Hafeez Contractor shares insights on eco-friendly architectural design, low-carbon cement, and solar facade integration in modern Indian skyscrapers.',
    speaker: 'Dr. Hafeez Contractor',
    author: 'AD Editorial',
    publishDate: new Date('2026-07-28'),
    readTime: '6 min read',
    category: 'Architecture',
    contentType: 'Interview',
    language: 'English',
    tags: ['Architecture', 'Sustainability', 'Green Building', 'High-Rise'],
    isFeatured: true,
    isActive: true
  },
  {
    title: 'The Future of Mivan Aluminium Formwork & 7-Day Floor Cycle in Indian Mass Housing',
    publication: 'Construction Week India',
    canonicalUrl: 'https://www.constructionweekonline.in/technology/mivan-formwork-speed-housing-construction/',
    articleUrl: 'https://www.constructionweekonline.in/technology/mivan-formwork-speed-housing-construction/',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800',
    summary: 'Er. N. Srikumar explains how monolithic aluminium formwork accelerates residential project completion while eliminating plastering defects.',
    speaker: 'Er. N. Srikumar',
    author: 'Construction Week Desk',
    publishDate: new Date('2026-07-25'),
    readTime: '5 min read',
    category: 'Prefab & Mivan',
    contentType: 'Technology Update',
    language: 'English',
    tags: ['Mivan', 'Formwork', 'Housing', 'Speed Construction'],
    isFeatured: true,
    isActive: true
  },
  {
    title: 'RERA Compliance, Escrow Account Audit & Risk Mitigation for Builders',
    publication: 'ET Realty',
    canonicalUrl: 'https://realty.economictimes.indiatimes.com/news/industry/rera-compliance-escrow-audit-rules-2026/10293847',
    articleUrl: 'https://realty.economictimes.indiatimes.com/news/industry/rera-compliance-escrow-audit-rules-2026/10293847',
    imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
    summary: 'Adv. Ramesh Gowda details the latest statutory RERA guidelines, buyer fund protection rules, and DC land conversion verification steps.',
    speaker: 'Adv. Ramesh Gowda',
    author: 'ET Realty Bureau',
    publishDate: new Date('2026-07-22'),
    readTime: '7 min read',
    category: 'RERA & Legal',
    contentType: 'Legal Update',
    language: 'English',
    tags: ['RERA', 'Legal', 'Escrow', 'Real Estate'],
    isFeatured: true,
    isActive: true
  },
  {
    title: '3D Printing & Robotic Concrete Placement in Residential Villa Projects',
    publication: 'Construction World',
    canonicalUrl: 'https://www.constructionworld.in/article/3d-printing-robotic-concrete-villas/',
    articleUrl: 'https://www.constructionworld.in/article/3d-printing-robotic-concrete-villas/',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
    summary: 'Case study on 3D printed concrete walls reducing construction waste by 60% and labor dependency in villa developments.',
    speaker: 'Rajesh Kumar, BE Civil',
    author: 'CW Tech Editor',
    publishDate: new Date('2026-07-18'),
    readTime: '4 min read',
    category: 'BIM & AI',
    contentType: 'Case Study',
    language: 'English',
    tags: ['3D Printing', 'Robotics', 'Concrete', 'Innovation'],
    isFeatured: false,
    isActive: true
  },
  {
    title: 'BIM & Digital Twin Implementation for Zero-Defect Civil Structural Engineering',
    publication: 'Construction Week India',
    canonicalUrl: 'https://www.constructionweekonline.in/bim-digital-twin-civil-engineering-2026/',
    articleUrl: 'https://www.constructionweekonline.in/bim-digital-twin-civil-engineering-2026/',
    imageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800',
    summary: 'How 5D BIM modeling detects rebar clash, optimizes material procurement, and ensures structural code compliance under IS 456.',
    speaker: 'Er. Suresh Gowda',
    author: 'CW Engineering Desk',
    publishDate: new Date('2026-07-15'),
    readTime: '6 min read',
    category: 'Civil Engineering',
    contentType: 'Expert Opinion',
    language: 'English',
    tags: ['BIM', 'Civil Engineering', 'Digital Twin', 'IS 456'],
    isFeatured: false,
    isActive: true
  }
];

// Ensure Default Sources Exist
async function initializeDefaultSources() {
  const defaultSources = [
    {
      sourceName: 'Construction Week India',
      baseUrl: 'https://www.constructionweekonline.in',
      feedUrl: 'https://www.constructionweekonline.in/feed',
      sourceType: 'rss',
      isEnabled: true,
      syncIntervalHours: 6
    },
    {
      sourceName: 'Architectural Digest India',
      baseUrl: 'https://www.architecturaldigest.in',
      feedUrl: 'https://www.architecturaldigest.in/feed/rss',
      sourceType: 'rss',
      isEnabled: true,
      syncIntervalHours: 6
    },
    {
      sourceName: 'ET Realty',
      baseUrl: 'https://realty.economictimes.indiatimes.com',
      feedUrl: 'https://realty.economictimes.indiatimes.com/rss/topstories',
      sourceType: 'rss',
      isEnabled: true,
      syncIntervalHours: 6
    },
    {
      sourceName: 'Construction World',
      baseUrl: 'https://www.constructionworld.in',
      feedUrl: 'https://www.constructionworld.in/rss',
      sourceType: 'rss',
      isEnabled: true,
      syncIntervalHours: 6
    }
  ];

  for (const src of defaultSources) {
    const existing = await ExpertTalkSource.findOne({ sourceName: src.sourceName });
    if (!existing) {
      await ExpertTalkSource.create(src);
    }
  }
}

// Seed initial curated articles if collection empty
async function seedInitialArticlesIfEmpty() {
  const count = await ExpertTalkArticle.countDocuments();
  if (count === 0) {
    for (const art of INITIAL_CURATED_ARTICLES) {
      await ExpertTalkArticle.create(art);
    }
  }
}

// Perform Full Auto-Sync Flow
async function runExpertTalksSync(triggerType = 'scheduled') {
  const syncCode = `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const syncLog = new ExpertTalkSyncLog({
    syncCode,
    startedAt: new Date(),
    triggerType,
    status: 'in_progress'
  });
  await syncLog.save();

  await initializeDefaultSources();
  await seedInitialArticlesIfEmpty();

  const enabledSources = await ExpertTalkSource.find({ isEnabled: true });
  syncLog.sourcesChecked = enabledSources.length;

  let totalDiscovered = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDuplicates = 0;
  let totalInvalid = 0;
  const syncErrors = [];

  for (const source of enabledSources) {
    source.lastSyncAt = new Date();
    try {
      let articles = [];
      try {
        const feedXml = await fetchFeedData(source.feedUrl);
        articles = parseRssFeed(feedXml, source.sourceName);
      } catch (feedErr) {
        // Log source error but continue remaining sources
        source.lastError = feedErr.message;
        source.failureCount += 1;
        syncErrors.push({ sourceName: source.sourceName, message: feedErr.message });
      }

      totalDiscovered += articles.length;

      for (const art of articles) {
        const canonicalUrl = art.canonicalUrl;
        const existing = await ExpertTalkArticle.findOne({ canonicalUrl });

        if (existing) {
          totalDuplicates++;
          // Update metadata if headline or image changed
          let updated = false;
          if (art.title && art.title !== existing.title) {
            existing.title = art.title;
            updated = true;
          }
          if (art.imageUrl && art.imageUrl !== existing.imageUrl) {
            existing.imageUrl = art.imageUrl;
            updated = true;
          }
          if (art.summary && art.summary !== existing.summary) {
            existing.summary = art.summary;
            updated = true;
          }
          existing.lastFetchedAt = new Date();
          if (updated) {
            await existing.save();
            totalUpdated++;
          }
        } else {
          await ExpertTalkArticle.create({
            ...art,
            firstFetchedAt: new Date(),
            lastFetchedAt: new Date()
          });
          totalInserted++;
        }
      }

      if (articles.length > 0 || source.failureCount === 0) {
        source.lastSuccessfulSyncAt = new Date();
        source.failureCount = 0;
        source.lastError = '';
      }

      const nextSync = new Date();
      nextSync.setHours(nextSync.getHours() + (source.syncIntervalHours || 6));
      source.nextSyncAt = nextSync;
      await source.save();

    } catch (err) {
      source.lastError = err.message;
      source.failureCount += 1;
      await source.save();
      syncErrors.push({ sourceName: source.sourceName, message: err.message });
    }
  }

  syncLog.completedAt = new Date();
  syncLog.recordsDiscovered = totalDiscovered;
  syncLog.recordsInserted = totalInserted;
  syncLog.recordsUpdated = totalUpdated;
  syncLog.duplicatesSkipped = totalDuplicates;
  syncLog.invalidLinksSkipped = totalInvalid;
  syncLog.errors = syncErrors;
  syncLog.status = syncErrors.length > 0 ? (totalInserted > 0 ? 'completed_with_errors' : 'failed') : 'completed';

  await syncLog.save();

  return {
    syncCode,
    status: syncLog.status,
    recordsInserted: totalInserted,
    recordsUpdated: totalUpdated,
    duplicatesSkipped: totalDuplicates,
    sourcesChecked: enabledSources.length,
    errorsCount: syncErrors.length
  };
}

module.exports = {
  initializeDefaultSources,
  seedInitialArticlesIfEmpty,
  runExpertTalksSync
};

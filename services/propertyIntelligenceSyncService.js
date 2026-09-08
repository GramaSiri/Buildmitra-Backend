const PropertyIntelligence = require('../models/PropertyIntelligence');
const ExpertTalkArticle = require('../models/ExpertTalkArticle');
const { fetchFeedData, parseRssFeed } = require('./expertTalkSourceAdapters');

const DEDICATED_FEEDS = [
  {
    name: 'ET Realty',
    url: 'https://realty.economictimes.indiatimes.com/rss/topstories'
  },
  {
    name: 'The Hindu Bengaluru',
    url: 'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss'
  },
  {
    name: 'Indian Express Bengaluru',
    url: 'https://indianexpress.com/section/cities/bangalore/feed/'
  },
  {
    name: 'Times of India Bengaluru',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms'
  },
  {
    name: 'Construction World',
    url: 'https://www.constructionworld.in/rss'
  },
  {
    name: 'Construction Week India',
    url: 'https://www.constructionweekonline.in/feed'
  }
];

const TRUSTED_HOSTS = [
  'bdabangalore.org', 'bbmp.gov.in', 'karnataka.gov.in', 'rera.karnataka.gov.in',
  'indiankanoon.org', 'sci.gov.in', 'karnatakajudiciary.kar.nic.in',
  'realty.economictimes.indiatimes.com', 'economictimes.indiatimes.com',
  'thehindu.com', 'indianexpress.com', 'newindianexpress.com', 'deccanherald.com',
  'timesofindia.indiatimes.com', 'business-standard.com', 'moneycontrol.com',
  'constructionworld.in', 'constructionweekonline.in', 'cushmanwakefield.com',
  'jll.co.in', 'anarock.com', 'knightfrank.co.in', 'colliers.com'
];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadline(value) {
  return decodeEntities(value).replace(/\s+-\s+(?:Trade Brains|Moneycontrol\.com|Business Standard|BigInfo\.in)$/i, '').trim();
}

function isTrustedSourceUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'news.google.com') return false;
    return TRUSTED_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

const BENGALURU_TERMS = [
  'bengaluru', 'bangalore', 'bda', 'greater bengaluru', 'gba', 'bbmp', 'karnataka rera',
  'kempegowda', 'whitefield', 'sarjapur', 'electronic city', 'north bengaluru',
  'devanahalli', 'kanakapura', 'bannerghatta', 'hebbal', 'yelahanka', 'hoskote'
];

function classify(text) {
  const value = String(text || '').toLowerCase();
  if (/\bbda\b|bangalore development authority/.test(value)) return 'BDA';
  if (/\bgba\b|greater bengaluru authority|bbmp/.test(value)) return 'GBA';
  if (/rera|court|policy|rule|tax|approval|legal|acquisition/.test(value)) return 'Policy & Legal';
  if (/launch|new project|new phase|rera registered/.test(value)) return 'New Launch';
  if (/price|rate|appreciation|capital value/.test(value)) return 'Price Trend';
  if (/inventory|supply|absorption|unsold|sales velocity/.test(value)) return 'Inventory & Supply';
  if (/rent|rental|demand|yield|tenant/.test(value)) return 'Demand & Rental';
  if (/metro|road|airport|rail|tunnel|corridor|infrastructure/.test(value)) return 'Infrastructure';
  if (/forecast|outlook|projection/.test(value)) return 'Forecast';
  return 'Developer Activity';
}

function isRelevant(article) {
  const text = `${article.title || ''} ${article.summary || ''} ${(article.tags || []).join(' ')}`.toLowerCase();
  const isBengaluru = BENGALURU_TERMS.some(term => text.includes(term));
  const isProperty = /real estate|realty|housing|property|developer|residential|commercial|villa|plot|apartment|infrastructure|rera|authority/.test(text);
  return isBengaluru && isProperty;
}

async function runPropertyIntelligenceSync(triggerType = 'scheduled') {
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const candidates = await ExpertTalkArticle.find({
    isActive: true,
    $or: [{ publishDate: { $gte: since } }, { createdAt: { $gte: since } }]
  }).sort({ publishDate: -1 }).limit(250).lean();

  let discovered = 0;
  let draftsCreated = 0;
  let duplicatesSkipped = 0;
  const feedErrors = [];

  const saveDraft = async (article, sourceLabel) => {
    if (!article || !isRelevant(article)) return;
    const publishedAt = article.publishDate ? new Date(article.publishDate) : new Date();
    if (Number.isNaN(publishedAt.getTime()) || publishedAt < since) return;
    discovered += 1;
    const canonicalUrl = String(article.canonicalUrl || article.articleUrl || '').split('?')[0];
    if (!canonicalUrl) return;
    if (!isTrustedSourceUrl(article.articleUrl)) return;
    const exists = await PropertyIntelligence.exists({ canonicalUrl });
    if (exists) {
      duplicatesSkipped += 1;
      return;
    }

    await PropertyIntelligence.create({
      headline: cleanHeadline(article.title),
      summary: decodeEntities(article.summary || article.title).slice(0, 1200),
      category: classify(`${article.title} ${article.summary}`),
      authority: /\bbda\b|bangalore development authority/i.test(`${article.title} ${article.summary}`) ? 'BDA' : (/\bgba\b|greater bengaluru/i.test(`${article.title} ${article.summary}`) ? 'GBA' : ''),
      sourceName: sourceLabel || article.publication || 'Approved Source',
      sourceUrl: article.articleUrl,
      canonicalUrl,
      sourcePublishedAt: publishedAt,
      tags: [...new Set([...(article.tags || []), 'Bengaluru Real Estate'])],
      status: 'draft',
      collectedBy: 'automatic',
      reviewRemarks: `Collected by ${triggerType} sync. Admin must open and verify the original source, correct the classification, and complete Why it matters and Watch next before publishing.`
    });
    draftsCreated += 1;
  };

  for (const article of candidates) {
    await saveDraft(article, article.publication);
  }

  for (const feed of DEDICATED_FEEDS) {
    try {
      const xml = await fetchFeedData(feed.url);
      const articles = parseRssFeed(xml, feed.name).slice(0, 40);
      for (const article of articles) await saveDraft(article, feed.name);
    } catch (error) {
      feedErrors.push({ source: feed.name, message: error.message });
    }
  }

  return {
    success: true,
    candidatesChecked: candidates.length,
    dedicatedFeedsChecked: DEDICATED_FEEDS.length,
    discovered,
    draftsCreated,
    duplicatesSkipped,
    feedErrors
  };
}

module.exports = { runPropertyIntelligenceSync, isTrustedSourceUrl, decodeEntities };

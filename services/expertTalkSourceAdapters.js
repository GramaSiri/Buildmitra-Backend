const https = require('https');
const http = require('http');
const URL = require('url').URL;

// Industry Keywords for Relevance Filter
const RELEVANT_KEYWORDS = [
  'construction', 'building', 'architect', 'architecture', 'civil', 'structural',
  'mivan', 'formwork', 'concrete', 'rebar', 'steel', 'cement', 'foundation', 'slab',
  'real estate', 'realty', 'housing', 'rera', 'proptech', 'bim', '3d print', 'prefab',
  'modular', 'green building', 'sustainability', 'waterproofing', 'plaster', 'tiles',
  'tycoon', 'interview', 'keynote', 'ceo', 'director', 'engineer', 'contractor', 'developer',
  'smart building', 'infrastructure', 'equipment', 'machinery', 'jcb'
];

// Fallback high quality construction/architectural images per source
const SOURCE_FALLBACK_IMAGES = {
  'Construction Week India': 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800',
  'Architectural Digest India': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  'ET Realty': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
  'Construction World': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800'
};

// Validate URL safety
function isValidExternalUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Clean HTML tags and sanitize string
function sanitizeText(str) {
  if (!str) return '';
  return str
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract Speaker / Expert Name from Title or Summary
function extractSpeakerName(title, summary) {
  const text = `${title} ${summary}`;
  // Look for patterns like "Er. Suresh Gowda", "Dr. Hafeez Contractor", "Mr. Rajesh Kumar", "Interview with B.S. Sharma"
  const match = text.match(/(Dr\.|Er\.|Ar\.|Mr\.|Ms\.|Adv\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  const interviewMatch = text.match(/(?:interview with|talk by|says|keynote by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (interviewMatch) {
    return interviewMatch[1];
  }
  return 'Industry Leader';
}

// Auto-Detect Category & Content Type based on text analysis
function classifyArticleContent(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  let category = 'Construction Tech';
  if (text.includes('architect') || text.includes('elevation') || text.includes('facade') || text.includes('design')) {
    category = 'Architecture';
  } else if (text.includes('civil') || text.includes('structural') || text.includes('beam') || text.includes('column') || text.includes('footing')) {
    category = 'Civil Engineering';
  } else if (text.includes('mivan') || text.includes('formwork') || text.includes('prefab') || text.includes('3d print')) {
    category = 'Prefab & Mivan';
  } else if (text.includes('bim') || text.includes('proptech') || text.includes('ai ') || text.includes('digital twin')) {
    category = 'BIM & AI';
  } else if (text.includes('rera') || text.includes('legal') || text.includes('law') || text.includes('escrow') || text.includes('bda') || text.includes('bbmp')) {
    category = 'RERA & Legal';
  } else if (text.includes('realty') || text.includes('real estate') || text.includes('housing') || text.includes('market') || text.includes('price')) {
    category = 'Real Estate & PropTech';
  } else if (text.includes('green') || text.includes('solar') || text.includes('sustainable') || text.includes('carbon')) {
    category = 'Sustainability & Green Building';
  } else if (text.includes('cement') || text.includes('steel') || text.includes('concrete') || text.includes('tile') || text.includes('block')) {
    category = 'Building Materials';
  }

  let contentType = 'Technology Update';
  if (text.includes('interview') || text.includes('speaks to') || text.includes('conversation')) {
    contentType = 'Interview';
  } else if (text.includes('keynote') || text.includes('address') || text.includes('speech')) {
    contentType = 'Keynote';
  } else if (text.includes('case study') || text.includes('project spotlight')) {
    contentType = 'Case Study';
  } else if (text.includes('rera') || text.includes('policy') || text.includes('rule')) {
    contentType = 'Legal Update';
  } else if (text.includes('market') || text.includes('outlook') || text.includes('trend')) {
    contentType = 'Market Update';
  } else if (category === 'Architecture') {
    contentType = 'Architecture';
  }

  return { category, contentType };
}

// Calculate Read Time from summary length
function calculateReadTime(summaryText) {
  const wordCount = summaryText.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 50) + 2;
  return `${minutes} min read`;
}

// Check relevance of article for BuildMitra users
function isIndustryRelevant(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  return RELEVANT_KEYWORDS.some(kw => text.includes(kw));
}

// Simple XML/RSS parser without heavy external dependencies
function parseRssFeed(xmlText, sourceName) {
  const items = [];
  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const rawItem = match[0];

    const titleMatch = rawItem.match(/<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
    const title = sanitizeText((titleMatch && (titleMatch[1] || titleMatch[2])) || '');

    const linkMatch = rawItem.match(/<link[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i) ||
                      rawItem.match(/href=["']([^"']+)["']/i);
    const articleUrl = (linkMatch && (linkMatch[1] || linkMatch[2])) || '';

    const descMatch = rawItem.match(/<description[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i) ||
                      rawItem.match(/<summary[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/summary>/i) ||
                      rawItem.match(/<content[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content>/i);
    const summary = sanitizeText((descMatch && (descMatch[1] || descMatch[2])) || title);

    const dateMatch = rawItem.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
                      rawItem.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i) ||
                      rawItem.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const rawDate = (dateMatch && dateMatch[1]) || new Date().toISOString();

    const imgMatch = rawItem.match(/<media:content[^>]*url=["']([^"']+)["']/i) ||
                     rawItem.match(/<enclosure[^>]*url=["']([^"']+)["']/i) ||
                     rawItem.match(/<img[^>]*src=["']([^"']+)["']/i);
    const imageUrl = (imgMatch && imgMatch[1] && isValidExternalUrl(imgMatch[1])) ? imgMatch[1] : SOURCE_FALLBACK_IMAGES[sourceName];

    if (title && articleUrl && isValidExternalUrl(articleUrl) && isIndustryRelevant(title, summary)) {
      const { category, contentType } = classifyArticleContent(title, summary);
      const speaker = extractSpeakerName(title, summary);

      items.push({
        title,
        publication: sourceName,
        sourceId: articleUrl,
        canonicalUrl: articleUrl.split('?')[0],
        articleUrl,
        imageUrl,
        summary: summary.length > 280 ? summary.substring(0, 277) + '...' : summary,
        speaker,
        author: sourceName + ' Editorial',
        publishDate: new Date(rawDate).toString() !== 'Invalid Date' ? new Date(rawDate) : new Date(),
        readTime: calculateReadTime(summary),
        category,
        contentType,
        language: 'English',
        tags: [category, contentType, sourceName],
        isFeatured: title.toLowerCase().includes('interview') || title.toLowerCase().includes('keynote') || title.toLowerCase().includes('mivan'),
        isActive: true
      });
    }
  }

  return items;
}

// Fetch Feed HTTP Request
function fetchFeedData(feedUrl) {
  return new Promise((resolve, reject) => {
    if (!isValidExternalUrl(feedUrl)) {
      return reject(new Error('Invalid or unsafe feed URL'));
    }

    const client = feedUrl.startsWith('https:') ? https : http;
    const req = client.get(feedUrl, {
      headers: {
        'User-Agent': 'BuildMitra-IndustryNewsBot/2.0 (+https://buildmitra.com)'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchFeedData(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} status code received from feed`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Feed request timed out'));
    });
  });
}

module.exports = {
  isValidExternalUrl,
  sanitizeText,
  extractSpeakerName,
  classifyArticleContent,
  isIndustryRelevant,
  parseRssFeed,
  fetchFeedData,
  SOURCE_FALLBACK_IMAGES
};

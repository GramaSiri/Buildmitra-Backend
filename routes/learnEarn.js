const express = require('express');
const router = express.Router();
const ExpertTalkArticle = require('../models/ExpertTalkArticle');
const ExpertTalkSource = require('../models/ExpertTalkSource');
const ExpertTalkSyncLog = require('../models/ExpertTalkSyncLog');
const Magazine = require('../models/Magazine');
const { runExpertTalksSync, seedInitialArticlesIfEmpty } = require('../services/expertTalkSyncService');

// Curated Seed Data for Magazines
const CURATED_MAGAZINES = [
  {
    title: 'Construction Week India — July 2026: Precast Megaprojects & Smart Concretes',
    publication: 'Construction Week India',
    edition: 'July 2026',
    issueNumber: 'Vol 16, Issue 7',
    publishDate: new Date('2026-07-01'),
    coverImageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=800',
    pdfUrl: 'https://www.constructionweekonline.in/digital-magazine/cwi-july-2026.pdf',
    readUrl: 'https://www.constructionweekonline.in/digital-magazine/cwi-july-2026',
    summary: 'Exclusive cover feature on India\'s rapid shift to precast segmental bridges, automated rebar tying robots, and high-performance Grade 60 fly-ash concrete mixes.',
    highlights: [
      'Precast High-Rise Construction in Bengaluru & Mumbai Metro Corridors',
      'Green Cement: UltraTech, ACC & Dalmia\'s Low-Carbon Slag Innovations',
      'CEOs Roundtable: Managing Rising TMT Steel Volatility & Supply Chain Sourcing'
    ],
    category: 'Civil & Infrastructure',
    pageCount: 96,
    fileSize: '24.5 MB',
    language: 'English',
    isFeatured: true,
    isActive: true,
    publisher: 'ITP Media Group',
    tags: ['Precast', 'Concrete', 'High-Rise', 'Infrastructure', 'CWI']
  },
  {
    title: 'Architectural Digest India — July 2026: Climate-Responsive Urban Living',
    publication: 'Architectural Digest India',
    edition: 'July 2026',
    issueNumber: 'Vol 15, Issue 4',
    publishDate: new Date('2026-07-05'),
    coverImageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    pdfUrl: 'https://www.architecturaldigest.in/digital-editions/adi-july-2026.pdf',
    readUrl: 'https://www.architecturaldigest.in/digital-editions/adi-july-2026',
    summary: 'Showcasing breathtaking vernacular architecture, solar courtyard designs, engineered timber ceilings, and sustainable terracotta rainscreens across top Indian villas.',
    highlights: [
      'Dr. Hafeez Contractor & Sanjay Puri on Biophilic Urban Masterplans',
      'Zero-Energy Luxury Homes: Integrating Geothermal Cooling & BIPV Solar',
      'Top 50 Natural Stone & Italian Marble Trends for Indian Penthouses'
    ],
    category: 'Architecture & Design',
    pageCount: 124,
    fileSize: '32.0 MB',
    language: 'English',
    isFeatured: true,
    isActive: true,
    publisher: 'Condé Nast India',
    tags: ['Architecture', 'Luxury Homes', 'Biophilic', 'Sustainable', 'AD India']
  },
  {
    title: 'ET Realty Digest — July 2026: PropTech, REITs & RERA Escrow Framework',
    publication: 'ET Realty',
    edition: 'July 2026',
    issueNumber: 'Vol 11, Issue 7',
    publishDate: new Date('2026-07-10'),
    coverImageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
    pdfUrl: 'https://realty.economictimes.indiatimes.com/magazine/etr-july-2026.pdf',
    readUrl: 'https://realty.economictimes.indiatimes.com/magazine/etr-july-2026',
    summary: 'Critical investigative analysis of RERA escrow compliance audits, digital land registries, and institutional foreign capital inflows into Tier-2 warehousing hubs.',
    highlights: [
      'Karnataka & Maharashtra RERA: Strict Penalties for Project Delay Clauses',
      'Commercial Real Estate Index: Office Leases Surge 22% Across Tech Parks',
      'Fractional Ownership & SEBI Small-Medium REIT Regulations Explained'
    ],
    category: 'Real Estate & Policy',
    pageCount: 88,
    fileSize: '19.2 MB',
    language: 'English',
    isFeatured: true,
    isActive: true,
    publisher: 'The Economic Times',
    tags: ['RERA', 'PropTech', 'REITs', 'Real Estate', 'ET Realty']
  },
  {
    title: 'Construction World — June 2026: Expressways, Tunneling & Heavy Earthmoving',
    publication: 'Construction World',
    edition: 'June 2026',
    issueNumber: 'Vol 28, Issue 6',
    publishDate: new Date('2026-06-15'),
    coverImageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800',
    pdfUrl: 'https://www.constructionworld.in/magazines/cw-june-2026.pdf',
    readUrl: 'https://www.constructionworld.in/magazines/cw-june-2026',
    summary: 'Special issue covering mega-tunneling projects, NHAI smart highway contracts, and telematics-enabled heavy excavators cutting fleet fuel costs.',
    highlights: [
      'NHAI 2026 Bidding Pipeline: Top 10 EPC Contractors Winning Package Bids',
      'Underground Metro Tunnels: Slurry vs Earth Pressure Balance TBM Comparison',
      'Diesel to Electric: The Fleet Decarbonization Drive in Indian Quarries'
    ],
    category: 'Civil & Infrastructure',
    pageCount: 104,
    fileSize: '28.4 MB',
    language: 'English',
    isFeatured: false,
    isActive: true,
    publisher: 'ASAPP Info Global Group',
    tags: ['Highways', 'Tunneling', 'Earthmoving', 'Machinery', 'Construction World']
  },
  {
    title: 'EPC World — July 2026: Industrial Sourcing, Steel TMT & Project Procurement',
    publication: 'EPC World',
    edition: 'July 2026',
    issueNumber: 'Vol 14, Issue 7',
    publishDate: new Date('2026-07-08'),
    coverImageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800',
    pdfUrl: 'https://www.epcworld.in/magazines/epc-july-2026.pdf',
    readUrl: 'https://www.epcworld.in/magazines/epc-july-2026',
    summary: 'Procurement benchmarks for primary steel manufacturers (Jindal, Tata, SAIL), bulk cement price indexes, and reverse auction best practices for EPC managers.',
    highlights: [
      'B2B Reverse Auctions: Slashing Material Sourcing Lead Times by 35%',
      'Quality Benchmarking: Fe 550D Rebars vs Corrosion-Resistant TMT Alloys',
      'Port & Logistics Modernization: Bulk Cement Terminals on the Western Coast'
    ],
    category: 'Building Materials & Concrete',
    pageCount: 92,
    fileSize: '21.8 MB',
    language: 'English',
    isFeatured: false,
    isActive: true,
    publisher: 'EPC World Media',
    tags: ['Procurement', 'TMT Steel', 'Cement', 'Supply Chain', 'EPC World']
  },
  {
    title: 'NBM&CW — June 2026: Advanced Admixtures, AAC Blocks & Waterproofing Formulations',
    publication: 'NBM&CW',
    edition: 'June 2026',
    issueNumber: 'Vol 31, Issue 6',
    publishDate: new Date('2026-06-20'),
    coverImageUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800',
    pdfUrl: 'https://www.nbmcw.com/digital-edition/nbmcw-june-2026.pdf',
    readUrl: 'https://www.nbmcw.com/digital-edition/nbmcw-june-2026',
    summary: 'Technical review of crystalline waterproofing admixtures, polycarboxylate ether superplasticizers for high-rise pumping, and precision AAC jointing mortars.',
    highlights: [
      'Preventing Basements Dampness: Modern Crystalline Waterproofing Coatings',
      'AAC Blocks vs Red Clay Bricks: Thermal Insulation & Structural Load Reduction',
      'Mivan Formwork Release Agents: Ensuring Mirror-Finish Fair-Faced Concrete'
    ],
    category: 'Building Materials & Concrete',
    pageCount: 110,
    fileSize: '26.1 MB',
    language: 'English',
    isFeatured: false,
    isActive: true,
    publisher: 'New Building Materials & Construction World',
    tags: ['Admixtures', 'AAC Blocks', 'Waterproofing', 'Mivan', 'NBM&CW']
  },
  {
    title: 'Construction Week India — May 2026: Top 100 Construction Powerlist',
    publication: 'Construction Week India',
    edition: 'May 2026',
    issueNumber: 'Vol 16, Issue 5',
    publishDate: new Date('2026-05-10'),
    coverImageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800',
    pdfUrl: 'https://www.constructionweekonline.in/digital-magazine/cwi-may-2026.pdf',
    readUrl: 'https://www.constructionweekonline.in/digital-magazine/cwi-may-2026',
    summary: 'The definitive power ranking of India\'s top 100 civil engineering tycoons, EPC contractors, and real estate developers shaping the nation\'s 5-trillion economy.',
    highlights: [
      'L&T, Shapoorji Pallonji, and Tata Projects: Order Book Analysis 2026-2027',
      'Workforce Upskilling: Training 200,000 Semi-Skilled Artisans on High-Tech Tools',
      'Digital Project Delivery: BIM 360, Procore, and Drone Surveying on Site'
    ],
    category: 'Civil & Infrastructure',
    pageCount: 140,
    fileSize: '35.5 MB',
    language: 'English',
    isFeatured: false,
    isActive: true,
    publisher: 'ITP Media Group',
    tags: ['Powerlist', 'Contractors', 'EPC', 'L&T', 'CWI']
  },
  {
    title: 'Architectural Digest India — May 2026: Craftsmanship, Stone & Tropical Modernism',
    publication: 'Architectural Digest India',
    edition: 'May 2026',
    issueNumber: 'Vol 15, Issue 3',
    publishDate: new Date('2026-05-18'),
    coverImageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800',
    pdfUrl: 'https://www.architecturaldigest.in/digital-editions/adi-may-2026.pdf',
    readUrl: 'https://www.architecturaldigest.in/digital-editions/adi-may-2026',
    summary: 'Exploring bespoke tropical villas in Goa and Bengaluru incorporating reclaimed teakwood, exposed laterite blocks, and natural lime-plaster finishes.',
    highlights: [
      'Tropical Modernism: Passive Shading, High Ceilings & Courtyard Cross-Ventilation',
      'Handcrafted Terrazzo & Chettinad Tiles: Revival in Luxury Residential Spaces',
      'Architect Interview: Studio Lotus on Cultural Authenticity & Contextual Design'
    ],
    category: 'Architecture & Design',
    pageCount: 118,
    fileSize: '30.2 MB',
    language: 'English',
    isFeatured: false,
    isActive: true,
    publisher: 'Condé Nast India',
    tags: ['Tropical Modernism', 'Terrazzo', 'Villas', 'Interior Design', 'AD India']
  }
];

// Helper to seed magazines if collection is empty
async function seedMagazinesIfEmpty() {
  try {
    const count = await Magazine.countDocuments();
    if (count === 0) {
      console.log('Seeding initial curated magazines collection into MongoDB...');
      await Magazine.insertMany(CURATED_MAGAZINES);
      console.log(`Successfully seeded ${CURATED_MAGAZINES.length} curated magazine issues.`);
    }
  } catch (err) {
    console.error('Error seeding initial magazines:', err.message);
  }
}

// -------------------------------------------------------------
// 1. EXPERT TALKS ENDPOINTS: /api/learn-earn/experts
// -------------------------------------------------------------
router.get('/experts', async (req, res) => {
  try {
    // Ensure initial articles are seeded if collection is empty
    if (seedInitialArticlesIfEmpty) {
      await seedInitialArticlesIfEmpty();
    }

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

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { summary: { $regex: q, $options: 'i' } },
        { speaker: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
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
        .limit(limitNum)
        .lean(),
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

    // Last sync log
    let lastLog = null;
    try {
      lastLog = await ExpertTalkSyncLog.findOne({ status: { $in: ['completed', 'completed_with_errors'] } })
        .sort({ completedAt: -1 });
    } catch (_) {}

    res.json({
      success: true,
      count: articles.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      articles,
      stats: {
        totalFeatured,
        articlesTodayCount: articlesTodayCount || articles.length,
        activePublicationsCount: activePublicationsCount.length || 4,
        lastSuccessfulSyncAt: lastLog ? lastLog.completedAt : new Date()
      }
    });
  } catch (err) {
    console.error('Error fetching /api/learn-earn/experts:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expert talks from database',
      error: err.message
    });
  }
});

// Sync trigger for expert talks
router.post('/experts/sync', async (req, res) => {
  try {
    const result = await runExpertTalksSync();
    res.json({
      success: true,
      message: 'Expert talks sync completed successfully',
      result
    });
  } catch (err) {
    console.error('Error executing expert talks sync:', err);
    res.status(500).json({
      success: false,
      message: 'Expert talks sync failed',
      error: err.message
    });
  }
});

// -------------------------------------------------------------
// 2. MAGAZINE UPDATES ENDPOINTS: /api/learn-earn/magazines
// -------------------------------------------------------------
router.get('/magazines', async (req, res) => {
  try {
    // Ensure initial magazines are seeded if collection is empty
    await seedMagazinesIfEmpty();

    const {
      publication,
      category,
      edition,
      search,
      featured,
      page = 1,
      limit = 20,
      sort
    } = req.query;

    const filter = { isActive: true };

    if (publication && publication !== 'All') filter.publication = publication;
    if (category && category !== 'All') filter.category = category;
    if (edition && edition !== 'All') filter.edition = edition;
    if (featured === 'true' || featured === true) filter.isFeatured = true;

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { summary: { $regex: q, $options: 'i' } },
        { publication: { $regex: q, $options: 'i' } },
        { edition: { $regex: q, $options: 'i' } },
        { highlights: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let sortOption = { isFeatured: -1, publishDate: -1, createdAt: -1 };
    if (sort === 'latest') {
      sortOption = { publishDate: -1, createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { publishDate: 1, createdAt: 1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const [magazines, totalCount, totalFeatured, activePublications] = await Promise.all([
      Magazine.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Magazine.countDocuments(filter),
      Magazine.countDocuments({ isFeatured: true, isActive: true }),
      Magazine.distinct('publication', { isActive: true })
    ]);

    const latestMagazine = await Magazine.findOne({ isActive: true }).sort({ publishDate: -1 }).lean();

    res.json({
      success: true,
      count: magazines.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      magazines,
      stats: {
        totalMagazines: totalCount,
        totalFeatured,
        activePublicationsCount: activePublications.length,
        latestEdition: latestMagazine ? latestMagazine.edition : 'July 2026',
        lastUpdated: latestMagazine ? latestMagazine.publishDate : new Date()
      }
    });
  } catch (err) {
    console.error('Error fetching /api/learn-earn/magazines:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve magazines from database',
      error: err.message
    });
  }
});

// Single magazine details
router.get('/magazines/:id', async (req, res) => {
  try {
    const item = await Magazine.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Magazine not found' });
    }
    item.readCount = (item.readCount || 0) + 1;
    await item.save();

    res.json({
      success: true,
      magazine: item
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving magazine', error: err.message });
  }
});

// Increment download counter
router.post('/magazines/:id/download', async (req, res) => {
  try {
    const item = await Magazine.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Magazine not found' });
    }
    item.downloadCount = (item.downloadCount || 0) + 1;
    await item.save();

    res.json({
      success: true,
      pdfUrl: item.pdfUrl,
      downloadCount: item.downloadCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Download counter error', error: err.message });
  }
});

// Re-seed endpoint for admin/maintenance
router.post('/magazines/seed', async (req, res) => {
  try {
    for (const mag of CURATED_MAGAZINES) {
      await Magazine.findOneAndUpdate(
        { title: mag.title },
        { $set: mag },
        { upsert: true, new: true }
      );
    }
    const total = await Magazine.countDocuments();
    res.json({
      success: true,
      message: 'Curated magazines successfully synced to MongoDB',
      totalCount: total
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Seeding failed', error: err.message });
  }
});

module.exports = router;


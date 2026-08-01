const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ConstructionVideo = require('../models/ConstructionVideo');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI missing in .env');
  process.exit(1);
}

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    const seedFilePath = path.join(__dirname, 'construction_videos_seed.json');
    if (!fs.existsSync(seedFilePath)) {
      console.error(`❌ Seed JSON file not found at ${seedFilePath}`);
      process.exit(1);
    }

    const videos = JSON.parse(fs.readFileSync(seedFilePath, 'utf8'));
    console.log(`Found ${videos.length} videos in seed file.`);

    // Reset collection if requested
    console.log('Clearing existing construction videos collection...');
    await ConstructionVideo.deleteMany({});

    let inserted = 0;
    let skipped = 0;

    for (const v of videos) {
      try {
        await ConstructionVideo.create({
          stageNumber: Number(v.stageNumber),
          stageName: v.stageName.trim(),
          videoTitle: v.videoTitle.trim(),
          youtubeUrl: v.youtubeUrl,
          youtubeId: v.youtubeId,
          language: v.language || 'Kannada',
          channelName: v.channelName ? v.channelName.trim() : 'Civil Construction Guide',
          duration: v.duration || 'N/A',
          shortDescription: v.shortDescription || '',
          displayOrder: Number(v.displayOrder || 1),
          isActive: v.isActive !== undefined ? v.isActive : true
        });
        inserted++;
      } catch (err) {
        skipped++;
        console.warn(`Skipped video ${v.youtubeId} (Error/Duplicate): ${err.message}`);
      }
    }

    console.log(`\n🎉 SEEDING COMPLETE!`);
    console.log(`Total Inserted: ${inserted}`);
    console.log(`Total Skipped: ${skipped}`);

    const countByStage = await ConstructionVideo.aggregate([
      { $group: { _id: "$stageNumber", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\nVideos per stage summary:');
    countByStage.forEach(s => {
      console.log(` Stage ${s._id}: ${s.count} videos`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();

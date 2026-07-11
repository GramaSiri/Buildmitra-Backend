const mongoose = require('mongoose');
const ProviderProduct = require('../models/ProviderProduct');
const Product = require('../models/Product');

async function backfillImages() {
  await mongoose.connect('mongodb://localhost:27017/buildmitra');
  console.log('✅ Connected to MongoDB');
  
  // Get all provider products
  const providerProducts = await ProviderProduct.find({});
  console.log(`📊 Found ${providerProducts.length} provider products`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const pp of providerProducts) {
    // Check if already has image
    if (pp.imagePath && pp.imagePath !== '') {
      skipped++;
      continue;
    }
    
    // Find master product
    const product = await Product.findOne({ masterCode: pp.masterCode });
    
    if (product && product.imagePath) {
      pp.imagePath = product.imagePath;
      pp.imageFileName = product.imageFileName || '';
      await pp.save();
      updated++;
      process.stdout.write(`\r✅ Updated: ${updated}, Skipped: ${skipped}`);
    } else {
      skipped++;
    }
  }
  
  console.log(`\n✅ Updated ${updated} provider products with images!`);
  console.log(`📊 ${skipped} products already had images or no master found`);
  mongoose.disconnect();
}

backfillImages();
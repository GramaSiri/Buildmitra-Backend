const mongoose = require('mongoose');
const Product = require('../models/Product');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = 'D:/images/Desktop/BMFrontend-2026-07-04/public/images/master-images';

// Create directory if not exists
if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    console.log('✅ Created image directory');
}

// Generate placeholder images
async function generateImages() {
    await mongoose.connect('mongodb://localhost:27017/buildmitra');
    console.log('✅ Connected to MongoDB');
    
    const products = await Product.find({});
    console.log(`📊 Found ${products.length} products`);
    
    let generated = 0;
    
    for (const product of products) {
        try {
            const imagePath = path.join(IMAGE_DIR, product.imageFileName);
            
            // Skip if image already exists
            if (fs.existsSync(imagePath)) {
                continue;
            }
            
            // Create SVG placeholder
            const svg = `
                <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                    <rect width="400" height="400" fill="#3498DB"/>
                    <rect x="50" y="50" width="300" height="300" rx="10" fill="rgba(255,255,255,0.1)"/>
                    <text x="200" y="180" font-family="Arial" font-size="20" fill="white" text-anchor="middle" font-weight="bold">${product.itemName || 'Product'}</text>
                    <text x="200" y="220" font-family="Arial" font-size="14" fill="#ddd" text-anchor="middle">${product.masterCode}</text>
                    <text x="200" y="260" font-family="Arial" font-size="12" fill="#bbb" text-anchor="middle">₹${product.basePrice || 0}</text>
                    <text x="200" y="290" font-family="Arial" font-size="12" fill="#aaa" text-anchor="middle">${product.category || ''}</text>
                    <text x="200" y="370" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.4)" text-anchor="middle">BuildMitra Marketplace</text>
                </svg>
            `;
            
            // Convert SVG to PNG
            await sharp(Buffer.from(svg))
                .png()
                .toFile(imagePath);
            
            generated++;
            process.stdout.write(`\r✅ Generated: ${generated}/${products.length}`);
        } catch (error) {
            console.log(`\n❌ Failed: ${product.masterCode} - ${error.message}`);
        }
    }
    
    console.log(`\n✅ Generated ${generated} placeholder images!`);
    mongoose.disconnect();
}

generateImages();
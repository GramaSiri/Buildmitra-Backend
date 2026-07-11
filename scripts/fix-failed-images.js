const mongoose = require('mongoose');
const Product = require('../models/Product');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = 'D:/images/Desktop/BMFrontend-2026-07-04/public/images/master-images';

// List of failed products (from the error)
const failedCodes = [
    'MAT-000632', 'MAT-000633', 'MAT-000634', 'MAT-000635', 'MAT-000636',
    'MAT-000637', 'MAT-000638', 'MAT-000639', 'MAT-000640', 'MAT-000641',
    'MAT-000642', 'MAT-000643', 'MAT-000644', 'MAT-000645', 'MAT-000646',
    'MAT-000647', 'MAT-000648', 'MAT-000649', 'MAT-000650', 'MAT-000651',
    'MAT-000652', 'MAT-000653', 'MAT-000654', 'MAT-000655', 'MAT-000656',
    'MAT-000657', 'MAT-000658', 'MAT-000659', 'MAT-000660', 'MAT-000661',
    'MAT-000662', 'MAT-000663', 'MAT-000664', 'MAT-000665', 'MAT-000666',
    'MAT-000667', 'MAT-000668', 'MAT-000669', 'MAT-000670', 'MAT-000671',
    'MAT-000672', 'MAT-000673', 'MAT-000674', 'MAT-000675', 'MAT-000676',
    'MAT-000677', 'MAT-000678', 'MAT-000679', 'MAT-000680', 'MAT-000681',
    'MAT-000682', 'MAT-000683', 'MAT-000886', 'MAT-000887'
];

async function fixFailedImages() {
    await mongoose.connect('mongodb://localhost:27017/buildmitra');
    console.log('✅ Connected to MongoDB');
    
    let fixed = 0;
    
    for (const code of failedCodes) {
        try {
            const product = await Product.findOne({ masterCode: code });
            if (!product) {
                console.log(`❌ Product not found: ${code}`);
                continue;
            }
            
            // Clean the product name - remove special characters
            const cleanName = product.itemName
                .replace(/[&'"]/g, '')  // Remove &, ', "
                .replace(/[^a-zA-Z0-9\s\-]/g, ' ')  // Replace other special chars with space
                .substring(0, 30);
            
            const imagePath = path.join(IMAGE_DIR, product.imageFileName || `${code}.png`);
            
            // SVG template with escaped text
            const svg = `
                <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                    <rect width="400" height="400" fill="#2C3E50"/>
                    <rect x="50" y="50" width="300" height="300" rx="10" fill="rgba(255,255,255,0.1)"/>
                    <text x="200" y="180" font-family="Arial" font-size="20" fill="white" text-anchor="middle" font-weight="bold">${cleanName}</text>
                    <text x="200" y="220" font-family="Arial" font-size="14" fill="#ddd" text-anchor="middle">${product.masterCode}</text>
                    <text x="200" y="260" font-family="Arial" font-size="12" fill="#bbb" text-anchor="middle">₹${product.basePrice || 0}</text>
                    <text x="200" y="290" font-family="Arial" font-size="12" fill="#aaa" text-anchor="middle">${product.category || ''}</text>
                    <text x="200" y="370" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.4)" text-anchor="middle">BuildMitra Marketplace</text>
                </svg>
            `;
            
            await sharp(Buffer.from(svg))
                .png()
                .toFile(imagePath);
            
            fixed++;
            console.log(`✅ Fixed: ${code} (${fixed}/${failedCodes.length})`);
        } catch (error) {
            console.log(`❌ Still failed: ${code} - ${error.message}`);
        }
    }
    
    console.log(`\n✅ Fixed ${fixed} images!`);
    mongoose.disconnect();
}

fixFailedImages();
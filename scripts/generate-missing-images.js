const mongoose = require('mongoose');
const Product = require('./models/Product');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_DIR = 'D:/images/Desktop/BMFrontend-2026-07-04/public/images/master-images';

if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    console.log('Created image directory');
}

async function generateMissingImages() {
    await mongoose.connect('mongodb://localhost:27017/buildmitra');
    console.log('Connected to MongoDB');
    
    const products = await Product.find({ status: 'Active' });
    console.log('Found ' + products.length + ' products');
    
    let generated = 0;
    let skipped = 0;
    
    for (const product of products) {
        const imagePath = path.join(IMAGE_DIR, product.masterCode + '.webp');
        
        if (fs.existsSync(imagePath)) {
            skipped++;
            continue;
        }
        
        try {
            const cleanName = (product.itemName || 'Product')
                .replace(/[&'"]/g, '')
                .replace(/[^a-zA-Z0-9\s\-]/g, ' ')
                .substring(0, 30);
            
            const color = product.category === 'Cement' ? '#2C3E50' :
                         product.category === 'TMT Bars' ? '#34495E' :
                         product.category === 'Concrete Blocks' ? '#A0522D' :
                         product.category === 'Aerocon Blocks' ? '#16A085' :
                         product.category === 'Bathroom Fittings' ? '#3498DB' :
                         product.category === 'Plumbing - CPVC' ? '#2ECC71' :
                         product.category === 'Electrical' ? '#F39C12' :
                         '#34495E';
            
            const svg = '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">' +
                '<rect width="400" height="400" fill="' + color + '"/>' +
                '<rect x="50" y="50" width="300" height="300" rx="10" fill="rgba(255,255,255,0.1)"/>' +
                '<text x="200" y="180" font-family="Arial" font-size="20" fill="white" text-anchor="middle" font-weight="bold">' + cleanName + '</text>' +
                '<text x="200" y="220" font-family="Arial" font-size="14" fill="#ddd" text-anchor="middle">' + product.masterCode + '</text>' +
                '<text x="200" y="260" font-family="Arial" font-size="12" fill="#bbb" text-anchor="middle">₹' + (product.basePrice || 0) + '</text>' +
                '<text x="200" y="290" font-family="Arial" font-size="12" fill="#aaa" text-anchor="middle">' + (product.category || '') + '</text>' +
                '<text x="200" y="370" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.4)" text-anchor="middle">BuildMitra Marketplace</text>' +
                '</svg>';
            
            await sharp(Buffer.from(svg))
                .png()
                .toFile(imagePath);
            
            generated++;
            if (generated % 100 === 0) {
                console.log('Generated: ' + generated + ' images');
            }
        } catch (error) {
            console.log('Failed: ' + product.masterCode + ' - ' + error.message);
        }
    }
    
    console.log('Generated ' + generated + ' placeholder images!');
    console.log('Skipped ' + skipped + ' existing images');
    mongoose.disconnect();
}

generateMissingImages();

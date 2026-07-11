const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const IMAGE_DIR = 'D:/images/Desktop/BMFrontend-2026-07-04/public/images/master-images/';

if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://buildmitra-openai.openai.azure.com/';
const apiKey = process.env.AZURE_OPENAI_KEY || 'YOUR-KEY-HERE';
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'dall-e';

async function generateImage(master) {
    const masterCode = master.masterItemCode;
    const productName = master.itemName || master.name || 'Product';
    const imagePath = path.join(IMAGE_DIR, masterCode + '.webp');
    
    if (fs.existsSync(imagePath)) {
        return { masterCode: masterCode, status: 'skipped', reason: 'already exists' };
    }
    
    const prompt = 'Professional product photo of ' + productName + ', studio lighting, realistic, high quality, isolated on white background, commercial photography, 4k, sharp focus';
    
    try {
        const response = await fetch(
            endpoint + 'openai/images/generations?api-version=2024-02-01',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    prompt: prompt,
                    size: '1024x1024',
                    n: 1,
                    quality: 'standard'
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            return { masterCode: masterCode, status: 'failed', reason: error.error?.message || 'API error' };
        }
        
        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        
        if (!imageUrl) {
            return { masterCode: masterCode, status: 'failed', reason: 'No image URL returned' };
        }
        
        const imageResponse = await fetch(imageUrl);
        const buffer = await imageResponse.arrayBuffer();
        
        const sharp = require('sharp');
        await sharp(Buffer.from(buffer))
            .webp({ quality: 85 })
            .toFile(imagePath);
        
        return { masterCode: masterCode, status: 'success', imagePath: '/images/master-images/' + masterCode + '.webp' };
        
    } catch (error) {
        return { masterCode: masterCode, status: 'failed', reason: error.message };
    }
}

async function generateAllImages() {
    await mongoose.connect('mongodb://localhost:27017/buildmitra');
    console.log('Connected to MongoDB');
    
    const MasterItem = require('../models/MasterItem');
    const masters = await MasterItem.find({ status: 'active' }).limit(5);
    
    console.log('Found ' + masters.length + ' master items');
    
    let success = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const master of masters) {
        const result = await generateImage(master);
        
        if (result.status === 'success') {
            success++;
            master.imageUrl = '/images/master-images/' + master.masterItemCode + '.webp';
            await master.save();
            console.log('Generated: ' + master.masterItemCode);
        } else if (result.status === 'skipped') {
            skipped++;
            console.log('Skipped: ' + master.masterItemCode + ' (already exists)');
        } else {
            failed++;
            console.log('Failed: ' + master.masterItemCode + ' - ' + result.reason);
        }
    }
    
    console.log('Complete! Success: ' + success + ', Failed: ' + failed + ', Skipped: ' + skipped);
    mongoose.disconnect();
}

generateAllImages().catch(console.error);

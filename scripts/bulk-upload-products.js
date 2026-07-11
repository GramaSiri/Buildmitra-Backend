const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

// ✅ CONFIGURATION - FIX THE PATHS
const EXCEL_PATH = 'D:/images/Desktop/BM_11_7.xlsx';
const IMAGE_BASE_URL = '/images/master-images/';  // Frontend path

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/buildmitra')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Read Excel
function readExcel() {
  try {
    // Check if file exists
    if (!fs.existsSync(EXCEL_PATH)) {
      console.error('❌ Excel file not found at:', EXCEL_PATH);
      process.exit(1);
    }
    
    const workbook = XLSX.readFile(EXCEL_PATH);
    console.log('📊 Available sheets:', workbook.SheetNames);
    
    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`✅ Read ${data.length} products from Excel (Sheet: ${sheetName})`);
    
    if (data.length === 0) {
      console.log('⚠️ No data found in Excel. Check if the sheet has headers.');
      console.log('📋 First row:', Object.keys(data[0] || {}));
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error reading Excel:', error.message);
    process.exit(1);
  }
}

// Upload products in batches
async function uploadProducts(batchSize = 100) {
  const products = readExcel();
  const total = products.length;
  
  if (total === 0) {
    console.log('⚠️ No products to upload. Exiting.');
    mongoose.disconnect();
    return;
  }
  
  let success = 0;
  let failed = 0;
  const failedProducts = [];

  console.log(`📊 Processing ${total} products in batches of ${batchSize}...`);

  for (let i = 0; i < total; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(total/batchSize)} (${batch.length} products)`);

    for (const product of batch) {
      try {
        // Get Master Code - handle different column names
        const masterCode = product['Master Code'] || product['MasterCode'] || product['Sr.No'] || '';
        
        if (!masterCode) {
          failed++;
          failedProducts.push({ name: product['Item Name'] || 'Unknown', reason: 'No Master Code' });
          continue;
        }

        // Prepare product data
        const productData = {
          masterCode: String(masterCode).trim(),
          legacyCode: product['Legacy Code'] ? String(product['Legacy Code']).trim() : '',
          category: product['Category'] || '',
          subCategory: product['Sub Category'] || '',
          brand: product['Brand/Short Code'] || '',
          itemName: product['Item Name'] || '',
          specification: product['Specification'] || '',
          unit: product['Unit'] || '',
          basePrice: parseFloat(product['Base Rate/Price']) || 0,
          gst: parseFloat(product['GST/TAX']) || 0,
          hsnCode: product['HSN Code'] ? String(product['HSN Code']).trim() : '',
          imageFileName: product['Image File Name'] || '',
          imagePath: product['Image File Name'] ? `${IMAGE_BASE_URL}${product['Image File Name']}` : '',
          imageAltText: product['Image Alt Text'] || product['Item Name'] || '',
          searchKeywords: product['Search Keywords'] || '',
          status: product['Status'] || 'Active'
        };

        // Check if product exists
        const existing = await Product.findOne({ masterCode: productData.masterCode });
        if (existing) {
          await Product.updateOne({ masterCode: productData.masterCode }, productData);
          success++;
          process.stdout.write(`\r✅ Updated: ${productData.masterCode}`);
        } else {
          await Product.create(productData);
          success++;
          process.stdout.write(`\r✅ Created: ${productData.masterCode}`);
        }
      } catch (error) {
        failed++;
        failedProducts.push({ 
          code: product['Master Code'] || 'Unknown', 
          name: product['Item Name'] || 'Unknown', 
          reason: error.message 
        });
        console.log(`\n❌ Failed: ${product['Master Code']} - ${error.message}`);
      }
    }

    console.log(`\n📊 Progress: ${success + failed}/${total} (Success: ${success}, Failed: ${failed})`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 UPLOAD SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total: ${total}`);

  if (failedProducts.length > 0 && failedProducts.length <= 20) {
    console.log('\n❌ Failed Products:');
    failedProducts.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.code || p.name} - ${p.reason}`);
    });
  } else if (failedProducts.length > 20) {
    console.log(`\n❌ ${failedProducts.length} products failed. Check logs for details.`);
  }

  mongoose.disconnect();
}

// Run the upload
uploadProducts(50).catch(console.error);
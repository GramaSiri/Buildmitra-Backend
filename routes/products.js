const express = require('express');
const router = express.Router();
const ProviderProduct = require('../models/ProviderProduct');
const Product = require('../models/Product');

// GET - All products available for provider to select
router.get('/available', async (req, res) => {
  try {
    const products = await Product.find({ status: 'Active' })
      .select('masterCode itemName category subCategory brand unit basePrice imagePath imageFileName')
      .sort({ category: 1, itemName: 1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET - Provider's selected products
router.get('/provider/:providerCode', async (req, res) => {
  try {
    const products = await ProviderProduct.find({ 
      providerUserCode: req.params.providerCode
    }).sort({ category: 1, productName: 1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Add/Update single provider product
router.post('/add', async (req, res) => {
  try {
    const { 
      providerUserCode, 
      providerName, 
      providerPhone,
      providerLocation,
      providerPincode,
      masterCode, 
      providerPrice, 
      providerStock, 
      deliveryTime,
      minOrderQty
    } = req.body;
    
    // Get master product details
    const product = await Product.findOne({ masterCode });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Upsert provider product with image from master
    const providerProduct = await ProviderProduct.findOneAndUpdate(
      { providerUserCode, masterCode },
      {
        providerUserCode,
        providerName,
        providerPhone: providerPhone || '',
        providerLocation: providerLocation || '',
        providerPincode: providerPincode || '',
        masterCode,
        productName: product.itemName,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
        unit: product.unit,
        // ✅ COPY IMAGE FROM MASTER
        imagePath: product.imagePath || '',
        imageFileName: product.imageFileName || '',
        providerPrice,
        providerStock: providerStock || 0,
        deliveryTime: deliveryTime || '',
        minOrderQty: minOrderQty || 0,
        status: 'active',
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, product: providerProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Bulk add products
router.post('/bulk-add', async (req, res) => {
  try {
    const { 
      providerUserCode, 
      providerName, 
      providerPhone,
      providerLocation,
      providerPincode,
      products 
    } = req.body;
    
    let added = 0;
    let failed = 0;
    
    for (const item of products) {
      try {
        // Get master product
        const product = await Product.findOne({ masterCode: item.masterCode });
        if (!product) {
          failed++;
          continue;
        }
        
        await ProviderProduct.findOneAndUpdate(
          { providerUserCode, masterCode: item.masterCode },
          {
            providerUserCode,
            providerName,
            providerPhone: providerPhone || '',
            providerLocation: providerLocation || '',
            providerPincode: providerPincode || '',
            masterCode: item.masterCode,
            productName: product.itemName,
            category: product.category,
            subCategory: product.subCategory,
            brand: product.brand,
            unit: product.unit,
            // ✅ COPY IMAGE FROM MASTER
            imagePath: product.imagePath || '',
            imageFileName: product.imageFileName || '',
            providerPrice: item.providerPrice || product.basePrice || 0,
            providerStock: item.providerStock || 0,
            deliveryTime: item.deliveryTime || '',
            minOrderQty: item.minOrderQty || 0,
            status: 'active',
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
        added++;
      } catch (err) {
        failed++;
      }
    }
    
    res.json({ success: true, added, failed, total: products.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Update provider product
router.put('/update', async (req, res) => {
  try {
    const { providerUserCode, masterCode, ...updates } = req.body;
    
    const providerProduct = await ProviderProduct.findOneAndUpdate(
      { providerUserCode, masterCode },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    
    if (!providerProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    res.json({ success: true, product: providerProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Remove provider product
router.delete('/:providerCode/:masterCode', async (req, res) => {
  try {
    await ProviderProduct.findOneAndDelete({
      providerUserCode: req.params.providerCode,
      masterCode: req.params.masterCode
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET - Marketplace (all active provider products)
router.get('/marketplace', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const query = { status: 'active' };
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { providerName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const products = await ProviderProduct.find(query)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await ProviderProduct.countDocuments(query);
    
    res.json({
      success: true,
      products,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
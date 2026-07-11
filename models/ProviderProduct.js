const mongoose = require('mongoose');

const ProviderProductSchema = new mongoose.Schema({
  providerUserCode: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  providerPhone: { type: String },
  providerLocation: { type: String },
  providerPincode: { type: String },
  
  masterCode: { type: String, required: true },
  productName: { type: String, required: true },
  category: { type: String },
  subCategory: { type: String },
  brand: { type: String },
  unit: { type: String },
  
  imagePath: { type: String, default: '' },
  imageFileName: { type: String, default: '' },
  
  providerPrice: { type: Number, required: true },
  providerStock: { type: Number, default: 0 },
  deliveryTime: { type: String, default: '' },
  minOrderQty: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['pending', 'active', 'inactive'], 
    default: 'active' 
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ProviderProductSchema.index({ providerUserCode: 1, masterCode: 1 }, { unique: true });

module.exports = mongoose.model('ProviderProduct', ProviderProductSchema);

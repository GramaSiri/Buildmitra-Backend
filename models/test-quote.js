const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/buildmitra');
    console.log('✅ Connected to MongoDB');
    
    const Quote = require('./models/Quote');
    console.log('✅ Quote model loaded');
    console.log('📊 Quote model type:', typeof Quote);
    console.log('📊 Quote.find exists:', typeof Quote.find === 'function' ? 'Yes ✅' : 'No ❌');
    console.log('📊 Quote.create exists:', typeof Quote.create === 'function' ? 'Yes ✅' : 'No ❌');
    
    const count = await Quote.countDocuments();
    console.log('📊 Total quotes in database:', count);
    
    const sample = await Quote.findOne({});
    if (sample) {
      console.log('📊 Sample quote found:', sample.quoteCode);
    }
    
    await mongoose.disconnect();
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();

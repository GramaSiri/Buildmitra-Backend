const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buildmitra');
        
        // Check quotes
        const quotes = await mongoose.connection.db.collection('quotes').find({}).toArray();
        console.log('=== QUOTES ===');
        console.log(JSON.stringify(quotes, null, 2));
        
        // Check enquiry
        const enquiry = await mongoose.connection.db.collection('enquiries').findOne({ enquiryCode: 'ENQ-000001' });
        console.log('\n=== ENQUIRY ===');
        console.log(JSON.stringify(enquiry, null, 2));
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkData();

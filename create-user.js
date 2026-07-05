const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/buildmitra')
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      phone: String,
      password: String,
      role: String
    });
    
    const User = mongoose.model('User', userSchema);
    
    // Delete existing user
    await User.deleteOne({ phone: '9876543219' });
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    const newUser = new User({
      name: 'Test User',
      email: 'test@buildmitra.com',
      phone: '9876543219',
      password: hashedPassword,
      role: 'user'
    });
    
    await newUser.save();
    console.log('');
    console.log('✅ User created successfully!');
    console.log('📱 Phone: 9876543219');
    console.log('🔑 Password: password123');
    console.log('📧 Email: test@buildmitra.com');
    console.log('');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });

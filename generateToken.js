import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    vendorName: 'Reddy Traders',
    tradeType: 'Mason',
    phone: '9876543210'
  },
  'buildmitra_secret_key', // must match JWT_SECRET in your .env
  { expiresIn: '1h' }
);

console.log('✅ Your test token:\n');
console.log(token);
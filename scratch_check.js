const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/buildmitra';

async function run() {
  await mongoose.connect(mongoUri);
  const MasterItem = require('./models/MasterItem');
  const MarketRate = require('./models/MarketRate');

  const codes = ['MAT-WTR-TNK', 'LAB-WTR-TNK', 'SRV-PCC-01', 'LAB-PCC-01', 'PLB-18', 'LAB-PLB-18', 'ELEC-15', 'LAB-ELEC-15', 'FCL-12', 'LAB-FCL-12'];

  const masters = await MasterItem.find({ masterItemCode: { $in: codes } }).lean();
  console.log('--- MasterItems ---');
  masters.forEach(m => console.log(m.masterItemCode, '-> refRate:', m.referenceRate, 'primary:', m.primaryMasterItemCode, 'linkedLabour:', m.linkedLabourItemCode, 'rateComp:', m.rateComponent));

  const rates = await MarketRate.find({ $or: [{ masterItemCode: { $in: codes } }, { itemCode: { $in: codes } }] }).lean();
  console.log('--- MarketRates ---');
  rates.forEach(r => console.log(r.itemCode || r.masterItemCode, '-> currentRate:', r.currentRate, 'primary:', r.primaryMasterItemCode, 'linkedLabour:', r.linkedLabourItemCode));

  await mongoose.disconnect();
}

run().catch(console.error);

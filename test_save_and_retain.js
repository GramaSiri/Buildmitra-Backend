const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/buildmitra';

async function testSaveAndRetain() {
  await mongoose.connect(mongoUri);
  const { updateCombinedBOQRate, resolveSingleRate } = require('./services/rateResolverService');

  console.log('--- Step 1: Save updated rates (Material: 125000, Labour: 38000) ---');
  const saveRes = await updateCombinedBOQRate({
    masterItemCode: 'MAT-WTR-TNK',
    materialRate: 125000,
    labourRate: 38000,
    unit: 'LS',
    city: 'Bengaluru'
  });
  console.log('Save Result:', saveRes);

  console.log('\n--- Step 2: Verify dynamic resolution for MAT-WTR-TNK ---');
  const matResolved = await resolveSingleRate({ masterItemCode: 'MAT-WTR-TNK' });
  console.log('Resolved MAT-WTR-TNK:', matResolved);

  console.log('\n--- Step 3: Verify dynamic resolution for LAB-WTR-TNK ---');
  const labResolved = await resolveSingleRate({ masterItemCode: 'LAB-WTR-TNK' });
  console.log('Resolved LAB-WTR-TNK:', labResolved);

  console.log('\n--- Step 4: Restore expected rates (Material: 120000, Labour: 35000) ---');
  const restoreRes = await updateCombinedBOQRate({
    masterItemCode: 'MAT-WTR-TNK',
    materialRate: 120000,
    labourRate: 35000,
    unit: 'LS',
    city: 'Bengaluru'
  });
  console.log('Restore Result:', restoreRes);

  await mongoose.disconnect();
}

testSaveAndRetain().catch(console.error);

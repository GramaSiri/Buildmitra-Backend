const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/buildmitra';

async function testDynamicRateWiring() {
  console.log('=== STARTING DYNAMIC RATE WIRING ACCEPTANCE TEST ===');
  await mongoose.connect(mongoUri);

  const { updateCombinedBOQRate, resolveSingleRate } = require('./services/rateResolverService');

  // Test 1: Update MAT-WTR-TNK (Material: 130000, Labour: 40000)
  console.log('\n--- 1. Testing Admin Update for MAT-WTR-TNK ---');
  const updateRes1 = await updateCombinedBOQRate({
    masterItemCode: 'MAT-WTR-TNK',
    materialRate: 130000,
    labourRate: 40000,
    unit: 'LS',
    city: 'Bengaluru'
  });
  console.log('Update Result 1:', updateRes1);

  // Test 2: Resolve MAT-WTR-TNK and LAB-WTR-TNK
  console.log('\n--- 2. Verifying Resolver outputs for MAT-WTR-TNK and LAB-WTR-TNK ---');
  const matRes = await resolveSingleRate({ masterItemCode: 'MAT-WTR-TNK' });
  const labRes = await resolveSingleRate({ masterItemCode: 'LAB-WTR-TNK' });

  console.log('MAT-WTR-TNK Resolved:', matRes.materialRate, '+', matRes.labourRate, '=', matRes.totalUnitRate);
  console.log('LAB-WTR-TNK Resolved:', labRes.materialRate, '+', labRes.labourRate, '=', labRes.totalUnitRate);

  if (matRes.materialRate !== 130000 || matRes.labourRate !== 40000 || matRes.totalUnitRate !== 170000) {
    throw new Error('MAT-WTR-TNK rate resolution mismatch');
  }
  if (labRes.materialRate !== 130000 || labRes.labourRate !== 40000 || labRes.totalUnitRate !== 170000) {
    throw new Error('LAB-WTR-TNK rate resolution mismatch');
  }

  // Test 3: Update SRV-PCC-01 (Material: 4200, Labour: 950)
  console.log('\n--- 3. Testing Admin Update for SRV-PCC-01 ---');
  const updateRes2 = await updateCombinedBOQRate({
    masterItemCode: 'SRV-PCC-01',
    materialRate: 4200,
    labourRate: 950,
    unit: 'CUM',
    city: 'Bengaluru'
  });
  console.log('Update Result 2:', updateRes2);

  const pccRes = await resolveSingleRate({ masterItemCode: 'SRV-PCC-01' });
  console.log('SRV-PCC-01 Resolved:', pccRes.materialRate, '+', pccRes.labourRate, '=', pccRes.totalUnitRate);

  if (pccRes.materialRate !== 4200 || pccRes.labourRate !== 950 || pccRes.totalUnitRate !== 5150) {
    throw new Error('SRV-PCC-01 rate resolution mismatch');
  }

  // Test 4: Restore MAT-WTR-TNK (120000, 35000) and SRV-PCC-01 (3800, 800)
  console.log('\n--- 4. Restoring baseline test rates ---');
  await updateCombinedBOQRate({ masterItemCode: 'MAT-WTR-TNK', materialRate: 120000, labourRate: 35000, unit: 'LS' });
  await updateCombinedBOQRate({ masterItemCode: 'SRV-PCC-01', materialRate: 3800, labourRate: 800, unit: 'CUM' });

  const finalMat = await resolveSingleRate({ masterItemCode: 'MAT-WTR-TNK' });
  console.log('Restored MAT-WTR-TNK:', finalMat.materialRate, '+', finalMat.labourRate, '=', finalMat.totalUnitRate);

  await mongoose.disconnect();
  console.log('\n=== ALL DYNAMIC RATE RESOLUTION TESTS PASSED SUCCESSFULLY! ===');
}

testDynamicRateWiring().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

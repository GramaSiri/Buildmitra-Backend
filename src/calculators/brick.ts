export default async function brickCalculator(inputs: any) {
  const wallArea = inputs.length * inputs.height;
  const mortarFactor = 1.1;
  
  let blockSize, blocksPerSqm, mortarQty;
  
  switch(inputs.blockType) {
    case 'clay':
      blockSize = { length: 0.23, height: 0.075 };
      blocksPerSqm = Math.ceil(1 / (blockSize.length * blockSize.height));
      mortarQty = wallArea * 0.024;
      break;
    case 'aac':
      blockSize = { length: 0.6, height: 0.2 };
      blocksPerSqm = Math.ceil(1 / (blockSize.length * blockSize.height));
      mortarQty = wallArea * 0.012;
      break;
    case 'interlocking':
      blockSize = { length: 0.3, height: 0.15 };
      blocksPerSqm = Math.ceil(1 / (blockSize.length * blockSize.height));
      mortarQty = wallArea * 0.006;
      break;
    default:
      blockSize = { length: 0.4, height: 0.2 };
      blocksPerSqm = 12.5;
      mortarQty = wallArea * 0.018;
  }
  
  const totalBlocks = blocksPerSqm * wallArea * mortarFactor;
  const cementBags = mortarQty * 7.5;
  const sandM3 = mortarQty * 0.045;
  
  const boqItems = [
    { desc: `${inputs.blockType.toUpperCase()} Blocks`, qty: Math.ceil(totalBlocks), unit: 'nos', amount: Math.ceil(totalBlocks) * 45 },
    { desc: 'Cement', qty: cementBags.toFixed(1), unit: 'bags', amount: cementBags * 380 },
    { desc: 'Sand', qty: sandM3.toFixed(2), unit: 'm³', amount: sandM3 * 1500 },
    { desc: 'Labour', qty: wallArea.toFixed(1), unit: 'm²', amount: wallArea * 250 }
  ];
  
  const total = boqItems.reduce((sum, item) => sum + item.amount, 0);
  return { success: true, boqItems, total: Math.round(total) };
}

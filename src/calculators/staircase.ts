import Rate from '../models/Rate';

export default async function staircaseCalculator(inputs: any) {
  const rates = await Rate.find({ category: 'material' });
  
  const getRate = (material: string, defaultVal: number) => {
    const rate = rates.find(r => r.material.toLowerCase().includes(material.toLowerCase()));
    return rate ? rate.price : defaultVal;
  };

  const qualityFactor = { standard: 1, luxury: 1.2, ultra: 1.4 }[inputs.quality] || 1;
  
  // Calculations
  const widthM = inputs.width * 0.3048;
  const treadM = inputs.tread * 0.0254;
  const riserM = inputs.riser * 0.0254;
  const flightLengthM = Math.hypot(riserM * inputs.numSteps, treadM * (inputs.numSteps - 1));
  const totalConcreteM3 = flightLengthM * widthM * (inputs.waistSlabThickness / 1000) * inputs.numFlights;
  
  const steelWeight = (flightLengthM / 0.15) * widthM * (inputs.mainBarDia * inputs.mainBarDia / 162) * 2;
  
  const boqItems = [
    { desc: 'RCC Concrete', qty: totalConcreteM3.toFixed(2), unit: 'm³', amount: totalConcreteM3 * getRate('concrete', 5400) * qualityFactor },
    { desc: `Steel ${inputs.mainBarDia}mm`, qty: steelWeight.toFixed(0), unit: 'kg', amount: steelWeight * getRate('steel', 65) * qualityFactor },
    { desc: 'Binding Wire', qty: (steelWeight * 0.09).toFixed(0), unit: 'kg', amount: steelWeight * 0.09 * getRate('binding wire', 85) },
    { desc: 'Cover Blocks', qty: Math.ceil(flightLengthM * widthM * 10), unit: 'nos', amount: Math.ceil(flightLengthM * widthM * 10) * getRate('cover block', 12) },
    { desc: 'Formwork', qty: (flightLengthM * widthM * 2).toFixed(1), unit: 'm²', amount: flightLengthM * widthM * 2 * getRate('formwork', 45) },
    { desc: `Floor Finishing (${inputs.finishMaterial})`, qty: ((treadM + riserM) * widthM * inputs.numSteps).toFixed(1), unit: 'm²', amount: ((treadM + riserM) * widthM * inputs.numSteps) * getRate(inputs.finishMaterial, 180) * qualityFactor },
    { desc: `Railing (${inputs.railingType})`, qty: (flightLengthM * 2).toFixed(1), unit: 'm', amount: flightLengthM * 2 * getRate(`${inputs.railingType} railing`, 350) },
    { desc: 'Labour', qty: totalConcreteM3.toFixed(2), unit: 'm³', amount: totalConcreteM3 * getRate('labour', 1200) * qualityFactor }
  ];
  
  const total = boqItems.reduce((sum, item) => sum + item.amount, 0);
  return { success: true, boqItems: boqItems.map(i => ({ ...i, amount: Math.round(i.amount) })), total: Math.round(total) };
}

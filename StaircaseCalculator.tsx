import { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

interface Rate {
  _id: string;
  name: string;
  price: number;
  unit: string;
}

const StaircaseCalculator = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ---- USER INPUTS ----
  const [width, setWidth] = useState(4);        // ft
  const [tread, setTread] = useState(10);       // inches
  const [riser, setRiser] = useState(7);        // inches
  const [numSteps, setNumSteps] = useState(12); // number of risers (steps)
  const [landingLength, setLandingLength] = useState(3); // ft (if landing present)
  const [landingWidth, setLandingWidth] = useState(4);   // ft (same as stair width by default)
  const [includeLanding, setIncludeLanding] = useState(true);
  const [finishMaterial, setFinishMaterial] = useState('granite'); // granite, vitrified, marble, wooden, concrete
  const [railingType, setRailingType] = useState('ms'); // ms, ss, wooden
  const [quality, setQuality] = useState<'standard' | 'luxury' | 'ultra'>('standard');

  // Fetch rates
  useEffect(() => {
    axios.get('http://localhost:5000/api/rates')
      .then(res => setRates(res.data))
      .catch(err => console.error('Failed to fetch rates', err));
  }, []);

  const getRate = (name: string, defaultVal: number): number => {
    const item = rates.find(r => r.name.toLowerCase().includes(name.toLowerCase()));
    return item ? item.price : defaultVal;
  };

  const calculate = () => {
    setLoading(true);
    setError(null);
    try {
      const qualityFactor = { standard: 1.0, luxury: 1.2, ultra: 1.4 }[quality];
      const widthM = width * 0.3048;
      const treadM = tread * 0.0254;
      const riserM = riser * 0.0254;
      const numRisers = numSteps;
      const goingTotalM = treadM * (numRisers - 1); // horizontal projection of flights
      const stairHeightM = riserM * numRisers;

      // Volume of concrete (waist slab + landing)
      const waistThicknessM = 0.15; // 6 inches – typical
      const flightLengthM = Math.hypot(stairHeightM, goingTotalM);
      const flightVolumeM3 = flightLengthM * widthM * waistThicknessM;
      let landingVolumeM3 = 0;
      if (includeLanding) {
        const landingLengthM = landingLength * 0.3048;
        const landingWidthM = landingWidth * 0.3048;
        landingVolumeM3 = landingLengthM * landingWidthM * waistThicknessM;
      }
      const totalConcreteM3 = flightVolumeM3 + landingVolumeM3;

      // Steel reinforcement: assume 80 kg per m³ of concrete
      const steelKg = totalConcreteM3 * 80 * qualityFactor;

      // Formwork area (surface area of flight + landing)
      const flightFormworkM2 = flightLengthM * widthM * 2; // both sides + soffit (approx)
      const landingFormworkM2 = includeLanding ? (landingLength * 0.3048) * (landingWidth * 0.3048) : 0;
      const formworkM2 = flightFormworkM2 + landingFormworkM2;

      // Finishing area (tread + riser) plus landing
      let finishingM2 = 0;
      for (let i = 0; i < numRisers; i++) {
        finishingM2 += (treadM * widthM) + (riserM * widthM);
      }
      if (includeLanding) finishingM2 += (landingLength * 0.3048) * (landingWidth * 0.3048);

      // Railing length (flight inclined length + landing perimeter)
      const railingLengthM = flightLengthM + (includeLanding ? (landingLength + landingWidth) * 2 : 0);

      // Material costs from rates
      const concreteRate = getRate('rcc concrete', 5400); // per m³
      const steelRate = getRate('steel', 65);
      const formworkRate = getRate('formwork', 45);
      const cementRate = getRate('cement', 400);
      const sandRate = getRate('sand', 55);
      const aggRate = getRate('aggregate', 1400);

      // Concrete material breakdown (for BOQ)
      const cementBags = totalConcreteM3 * 8;
      const sandM3 = totalConcreteM3 * 0.5;
      const aggM3 = totalConcreteM3 * 0.8;
      const cementCost = cementBags * cementRate;
      const sandCost = sandM3 * 35.315 * sandRate;
      const aggCost = aggM3 * 35.315 * aggRate;

      // Finishing material cost
      let finishRate = 0;
      switch (finishMaterial) {
        case 'granite': finishRate = getRate('granite slab', 180); break;
        case 'vitrified': finishRate = getRate('vitrified tile', 55); break;
        case 'marble': finishRate = getRate('marble', 250); break;
        case 'wooden': finishRate = getRate('wooden flooring', 300); break;
        default: finishRate = getRate('concrete tile', 40);
      }
      const finishingCost = finishingM2 * finishRate;

      // Railing cost
      let railingRate = 0;
      switch (railingType) {
        case 'ms': railingRate = getRate('MS railing', 350); break;
        case 'ss': railingRate = getRate('SS railing', 600); break;
        case 'wooden': railingRate = getRate('wooden railing', 500); break;
        default: railingRate = 350;
      }
      const railingCost = railingLengthM * railingRate;

      // Labour cost (approx per m³ of concrete)
      const labourCost = totalConcreteM3 * 1200 * qualityFactor;

      // Build BOQ items
      const items = [
        { desc: 'RCC Concrete (M20) – waist slab & landing', qty: totalConcreteM3.toFixed(2), unit: 'm³', rate: concreteRate, amount: totalConcreteM3 * concreteRate },
        { desc: 'Steel reinforcement (Fe500)', qty: steelKg.toFixed(0), unit: 'kg', rate: steelRate, amount: steelKg * steelRate },
        { desc: 'Cement (OPC 53 grade)', qty: cementBags.toFixed(0), unit: 'bags', rate: cementRate, amount: cementCost },
        { desc: 'River sand', qty: (sandM3 * 35.315).toFixed(0), unit: 'CFT', rate: sandRate, amount: sandCost },
        { desc: '20mm aggregate', qty: (aggM3 * 35.315).toFixed(0), unit: 'CFT', rate: aggRate, amount: aggCost },
        { desc: 'Formwork (shuttering)', qty: formworkM2.toFixed(1), unit: 'm²', rate: formworkRate, amount: formworkM2 * formworkRate },
        { desc: `Floor finishing (${finishMaterial})`, qty: finishingM2.toFixed(1), unit: 'm²', rate: finishRate, amount: finishingCost },
        { desc: `Railing (${railingType})`, qty: railingLengthM.toFixed(1), unit: 'm', rate: railingRate, amount: railingCost },
        { desc: 'Labour (skilled + unskilled)', qty: totalConcreteM3.toFixed(2), unit: 'm³', rate: 1200, amount: labourCost },
        { desc: 'Miscellaneous (5%)', qty: '', unit: '', rate: 0, amount: 0 }
      ];
      const subtotal = items.reduce((s, i) => s + i.amount, 0);
      const misc = subtotal * 0.05;
      items[items.length - 1].amount = misc;
      const total = subtotal + misc;
      setBoqItems(items.map(i => ({ ...i, amount: Math.round(i.amount) })));
      setGrandTotal(Math.round(total));
    } catch (err) {
      console.error(err);
      setError('Calculation error. Check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const wsData = [['#', 'Description', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)']];
    boqItems.forEach((item, idx) => {
      wsData.push([idx + 1, item.desc, item.qty, item.unit, item.rate, item.amount]);
    });
    wsData.push(['', '', '', '', 'Grand Total', grandTotal]);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staircase BOQ');
    XLSX.writeFile(wb, `staircase_boq_${Date.now()}.xlsx`);
  };

  const shareWhatsApp = () => {
    const text = `🏗️ Staircase BOQ\nTotal cost: ₹${grandTotal.toLocaleString()}\nDownload full report from BuildMitra.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-2xl font-extrabold text-blue-600 mb-2">🪜 Staircase Calculator</h2>
        <p className="text-sm text-gray-500 mb-4">IS 456 thumb rules | Concrete, steel, finishing, railing – detailed BOQ</p>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><label className="text-xs uppercase">Width (ft)</label><input type="number" step="0.5" value={width} onChange={e => setWidth(+e.target.value)} className="border p-1 w-full" /></div>
          <div><label className="text-xs uppercase">Tread (inches)</label><input type="number" step="0.5" value={tread} onChange={e => setTread(+e.target.value)} className="border p-1 w-full" /></div>
          <div><label className="text-xs uppercase">Riser (inches)</label><input type="number" step="0.5" value={riser} onChange={e => setRiser(+e.target.value)} className="border p-1 w-full" /></div>
          <div><label className="text-xs uppercase">Number of Steps</label><input type="number" value={numSteps} onChange={e => setNumSteps(+e.target.value)} className="border p-1 w-full" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={includeLanding} onChange={e => setIncludeLanding(e.target.checked)} /> Include Landing</div>
          {includeLanding && (
            <>
              <div><label className="text-xs uppercase">Landing Length (ft)</label><input type="number" step="0.5" value={landingLength} onChange={e => setLandingLength(+e.target.value)} className="border p-1 w-full" /></div>
              <div><label className="text-xs uppercase">Landing Width (ft)</label><input type="number" step="0.5" value={landingWidth} onChange={e => setLandingWidth(+e.target.value)} className="border p-1 w-full" /></div>
            </>
          )}
          <div><label className="text-xs uppercase">Finish Material</label><select value={finishMaterial} onChange={e => setFinishMaterial(e.target.value)} className="border p-1 w-full"><option value="granite">Granite</option><option value="vitrified">Vitrified Tile</option><option value="marble">Marble</option><option value="wooden">Wooden</option><option value="concrete">Concrete Tile</option></select></div>
          <div><label className="text-xs uppercase">Railing Type</label><select value={railingType} onChange={e => setRailingType(e.target.value)} className="border p-1 w-full"><option value="ms">MS (Mild Steel)</option><option value="ss">Stainless Steel</option><option value="wooden">Wooden</option></select></div>
          <div><label className="text-xs uppercase">Quality</label><select value={quality} onChange={e => setQuality(e.target.value as any)} className="border p-1 w-full"><option value="standard">Standard</option><option value="luxury">Luxury</option><option value="ultra">Ultra Luxury</option></select></div>
        </div>
        <button onClick={calculate} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">{loading ? 'Calculating...' : 'Calculate Staircase BOQ'}</button>
      </div>

      {boqItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
            <div><h3 className="text-xl font-bold">📋 Staircase Bill of Quantities</h3><p className="text-sm text-gray-500">Width: {width} ft | Tread: {tread}" | Riser: {riser}" | Steps: {numSteps}</p></div>
            <div className="flex gap-2">
              <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-1 rounded text-sm">📊 Excel</button>
              <button onClick={shareWhatsApp} className="bg-green-500 text-white px-3 py-1 rounded text-sm">💬 WhatsApp</button>
            </div>
          </div>
          <div className="overflow-x-auto p-4 max-h-[600px]">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr><th className="p-2">#</th><th className="p-2 text-left">Description</th><th className="p-2 text-right">Quantity</th><th className="p-2">Unit</th><th className="p-2 text-right">Rate (₹)</th><th className="p-2 text-right">Amount (₹)</th></tr>
              </thead>
              <tbody>
                {boqItems.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 text-center">{idx + 1}</td>
                    <td className="p-2">{item.desc}</td>
                    <td className="p-2 text-right">{item.qty.toLocaleString()}<table>
                    <td className="p-2">{item.unit}</td>
                    <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">₹{item.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={5} className="p-2 text-right">Grand Total</td>
                  <td className="p-2 text-right">₹{grandTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaircaseCalculator;
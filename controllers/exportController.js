import { generateBOQExcel } from '../utils/excelExporter.js';

export const exportBOQ = async (req, res) => {
  try {
    const { tradeType, vendorName } = req.user;

    if (tradeType !== 'Mason') {
      return res.status(403).json({ error: 'Export allowed only for Masons' });
    }

    const boqData = [
      { item: 'Cement', qty: 50, rate: 320 },
      { item: 'M Sand', qty: 3.5, rate: 1200 },
      { item: 'Blocks', qty: 400, rate: 28 },
    ];

    const buffer = await generateBOQExcel(boqData, vendorName);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=BOQ_${vendorName}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('❌ Export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
};
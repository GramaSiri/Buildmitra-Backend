import ExcelJS from 'exceljs';

export const generateBOQExcel = async (boqData, vendorName) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOQ');

  sheet.columns = [
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Quantity', key: 'qty', width: 15 },
    { header: 'Rate', key: 'rate', width: 15 },
    { header: 'Amount', key: 'amount', width: 20 },
  ];

  boqData.forEach(row => {
    sheet.addRow({
      item: row.item,
      qty: row.qty,
      rate: row.rate,
      amount: row.qty * row.rate,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};
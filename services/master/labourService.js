const { pool } = require("../../config/database");

async function getAllLabour() {
  const [rows] = await pool.query("SELECT * FROM labour_master ORDER BY trade");
  return rows;
}

async function addLabour(item) {
  const sql = `
    INSERT INTO labour_master
    (labour_code, trade, category, unit, rate, overtime_rate, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    item.labour_code || `LAB-${Date.now()}`,
    item.trade,
    item.category || "General",
    item.unit,
    item.rate || 0,
    item.overtime_rate || 0,
    item.description || "",
    item.status || "Active"
  ];
  const [result] = await pool.query(sql, values);
  return result;
}

module.exports = { getAllLabour, addLabour };

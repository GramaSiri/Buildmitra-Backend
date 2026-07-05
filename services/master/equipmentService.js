const { pool } = require("../../config/database");

async function getAllEquipment() {
  const [rows] = await pool.query("SELECT * FROM equipment_master ORDER BY equipment_name");
  return rows;
}

async function addEquipment(item) {
  const sql = `
    INSERT INTO equipment_master
    (equipment_code, equipment_name, category, unit, rate, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    item.equipment_code || `EQP-${Date.now()}`,
    item.equipment_name || item.item,
    item.category || "General",
    item.unit,
    item.rate || 0,
    item.description || "",
    item.status || "Active"
  ];
  const [result] = await pool.query(sql, values);
  return result;
}

module.exports = { getAllEquipment, addEquipment };

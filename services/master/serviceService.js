const { pool } = require("../../config/database");

async function getAllServices() {
  const [rows] = await pool.query("SELECT * FROM service_master ORDER BY module, service_name");
  return rows;
}

async function addService(item) {
  const sql = `
    INSERT INTO service_master
    (service_code, module, service_name, unit, rate, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    item.service_code || `SER-${Date.now()}`,
    item.module,
    item.service_name || item.service,
    item.unit,
    item.rate || 0,
    item.description || "",
    item.status || "Active"
  ];
  const [result] = await pool.query(sql, values);
  return result;
}

module.exports = { getAllServices, addService };

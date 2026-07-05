const { pool } = require("../../config/database");

async function getAllMaterials() {
  const [rows] = await pool.query(
    "SELECT * FROM material_master ORDER BY product_name"
  );
  return rows;
}

async function addMaterial(material) {
  const sql = `
    INSERT INTO material_master
    (material_code, product_name, category, brand, unit, rate, gst, stock, min_order, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    material.material_code || `MAT-${Date.now()}`,
    material.product_name,
    material.category || "General",
    material.brand || "",
    material.unit || "",
    Number(material.rate || 0),
    Number(material.gst || 0),
    Number(material.stock || 0),
    Number(material.min_order || 0),
    material.description || "",
    material.status || "Active"
  ];

  const [result] = await pool.query(sql, values);
  return result;
}

async function bulkAddMaterials(items) {
  if (!items || !items.length) return { inserted: 0 };

  const sql = `
    INSERT INTO material_master
    (material_code, product_name, category, brand, unit, rate, gst, stock, min_order, description, status)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      product_name=VALUES(product_name),
      category=VALUES(category),
      brand=VALUES(brand),
      unit=VALUES(unit),
      rate=VALUES(rate),
      gst=VALUES(gst),
      stock=VALUES(stock),
      min_order=VALUES(min_order),
      description=VALUES(description),
      status=VALUES(status)
  `;

  const values = items.map((m, i) => [
    m.material_code || `MAT-${Date.now()}-${i}`,
    m.product_name,
    m.category || "General",
    m.brand || "",
    m.unit || "",
    Number(m.rate || 0),
    Number(m.gst || 0),
    Number(m.stock || 0),
    Number(m.min_order || 0),
    m.description || "",
    m.status || "Active"
  ]);

  const [result] = await pool.query(sql, [values]);
  return { inserted: values.length, result };
}

async function updateMaterial(id, material) {
  const sql = `
    UPDATE material_master
    SET product_name=?, category=?, brand=?, unit=?, rate=?, gst=?, stock=?, min_order=?, description=?, status=?
    WHERE id=?
  `;

  await pool.query(sql, [
    material.product_name,
    material.category,
    material.brand,
    material.unit,
    Number(material.rate || 0),
    Number(material.gst || 0),
    Number(material.stock || 0),
    Number(material.min_order || 0),
    material.description || "",
    material.status || "Active",
    id
  ]);
}

async function deleteMaterial(id) {
  await pool.query("DELETE FROM material_master WHERE id=?", [id]);
}

module.exports = {
  getAllMaterials,
  addMaterial,
  bulkAddMaterials,
  updateMaterial,
  deleteMaterial
};
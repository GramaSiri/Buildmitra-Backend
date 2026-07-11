const MasterMaterial = require("../../models/MasterMaterial");

function normalizeMaterial(m = {}, index = 0) {
  const code = m.material_code || m.masterCode || `MAT-${Date.now()}-${index}`;

  return {
    material_code: code,
    masterCode: code,
    product_name: m.product_name || m.itemName || m.name || "",
    itemName: m.itemName || m.product_name || m.name || "",
    category: m.category || "General",
    subcategory: m.subcategory || "",
    brand: m.brand || "",
    specification: m.specification || m.description || "",
    unit: m.unit || "",
    rate: Number(m.rate || 0),
    gst: Number(m.gst || 0),
    stock: Number(m.stock || 0),
    min_order: Number(m.min_order || 0),
    image: m.image || m.imageUrl || "",
    imageUrl: m.imageUrl || m.image || "",
    description: m.description || m.specification || "",
    status: m.status || "Active"
  };
}

async function getAllMaterials() {
  return await MasterMaterial.find({ status: { $ne: "Deleted" } })
    .sort({ product_name: 1 })
    .lean();
}

async function addMaterial(material) {
  const doc = normalizeMaterial(material);
  return await MasterMaterial.create(doc);
}

async function bulkAddMaterials(items) {
  if (!items || !items.length) return { inserted: 0 };

  let inserted = 0;

  for (let i = 0; i < items.length; i++) {
    const doc = normalizeMaterial(items[i], i);

    if (!doc.product_name) continue;

    await MasterMaterial.updateOne(
      { material_code: doc.material_code },
      { $set: doc },
      { upsert: true }
    );

    inserted++;
  }

  return { inserted };
}

async function updateMaterial(id, material) {
  const doc = normalizeMaterial(material);
  return await MasterMaterial.findByIdAndUpdate(id, doc, { new: true });
}

async function deleteMaterial(id) {
  return await MasterMaterial.findByIdAndUpdate(
    id,
    { status: "Deleted" },
    { new: true }
  );
}

module.exports = {
  getAllMaterials,
  addMaterial,
  bulkAddMaterials,
  updateMaterial,
  deleteMaterial
};

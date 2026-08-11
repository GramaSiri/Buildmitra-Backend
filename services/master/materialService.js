const MasterItem = require("../../models/MasterItem");
const MarketRate = require("../../models/MarketRate");
const { createOrUpdateMasterItem } = require("../marketplaceService");

async function getAllMaterials() {
  const [items, rates] = await Promise.all([
    MasterItem.find({ status: "active" }).lean(),
    MarketRate.find({ approvalStatus: "approved", isActive: true }).lean()
  ]);

  const rateMap = new Map();
  rates.forEach(r => {
    if (r.masterItemCode) rateMap.set(r.masterItemCode, r.currentRate);
    if (r.itemCode) rateMap.set(r.itemCode, r.currentRate);
  });

  return items.map(i => ({
    ...i,
    id: i._id,
    material_code: i.masterItemCode,
    masterItemCode: i.masterItemCode,
    product_name: i.itemName,
    itemName: i.itemName,
    category: i.category,
    subCategory: i.subCategory,
    brand: i.brand,
    specification: i.specification,
    unit: i.unit,
    rate: rateMap.get(i.masterItemCode) ?? i.referenceRate ?? i.rate ?? 0,
    referenceRate: rateMap.get(i.masterItemCode) ?? i.referenceRate ?? 0,
    status: i.status
  }));
}

async function addMaterial(material) {
  const result = await createOrUpdateMasterItem(material, "admin");
  return result.item;
}

async function bulkAddMaterials(items) {
  if (!items || !items.length) return { inserted: 0, updated: 0, totalRows: 0 };

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const name = row.itemName || row.product_name || row.name;
    if (!name) {
      skipped++;
      continue;
    }
    const res = await createOrUpdateMasterItem(row, "admin");
    if (res.isNew) inserted++;
    else updated++;
  }

  return { inserted, updated, skipped, totalRows: items.length };
}

async function updateMaterial(id, material) {
  const item = await MasterItem.findById(id);
  if (!item) throw new Error("Item not found");
  const result = await createOrUpdateMasterItem({ ...material, masterItemCode: item.masterItemCode }, "admin");
  return result.item;
}

async function deleteMaterial(id) {
  const item = await MasterItem.findByIdAndUpdate(id, { status: "inactive" }, { new: true });
  if (item?.masterItemCode) {
    await MarketRate.updateMany(
      { $or: [{ masterItemCode: item.masterItemCode }, { itemCode: item.masterItemCode }] },
      { $set: { isActive: false } }
    );
  }
  return item;
}

module.exports = {
  getAllMaterials,
  addMaterial,
  bulkAddMaterials,
  updateMaterial,
  deleteMaterial
};

const XLSX = require("xlsx");
const { createOrUpdateMasterItem, defaultImageFor, cleanText } = require("./marketplaceService");

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}

function toNumber(value) {
  const n = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function standardizeName(value) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .replace(/\bopc\b/gi, "OPC")
    .replace(/\bppc\b/gi, "PPC")
    .replace(/\btmt\b/gi, "TMT")
    .replace(/\bcpvc\b/gi, "CPVC")
    .replace(/\bupvc\b/gi, "UPVC");
}

function normalizeExistingCode(value) {
  const code = cleanText(value).toUpperCase();
  if (!code) return "";
  if (/^MAT-\d{6}$/.test(code)) return code;
  if (/^MAT\d{6}$/.test(code)) return `MAT-${code.slice(3)}`;
  return code.replace(/\s+/g, "-");
}

function generatedMaterialCode(index) {
  return `MAT-${String(index + 1).padStart(6, "0")}`;
}

function mapMaterialRow(row, index) {
  const category = cleanText(pick(row, ["Category", "category", "Main Category", "MainCategory", "Material Category"])) || "Other";
  const subCategory = cleanText(pick(row, ["SubCategory", "Sub Category", "subCategory", "Sub-category"]));
  const itemName = standardizeName(pick(row, ["Item Name", "ItemName", "Item", "item", "Product", "Product Name", "ProductName", "Material", "Description"]));
  const brand = cleanText(pick(row, ["Brand", "brand", "Make", "make", "Company", "Manufacturer"]));
  const specification = cleanText(pick(row, ["Specification", "Spec", "Specs", "Grade", "Description", "description", "Size", "Type"]));
  const unit = cleanText(pick(row, ["Unit", "unit", "UOM", "uom", "Uom", "Units"])) || "Unit";
  const existingCode = normalizeExistingCode(pick(row, ["masterItemCode", "Master Item Code", "MasterItemCode", "Code", "code", "Material Code", "MaterialCode", "Item Code", "ItemCode"]));
  const masterItemCode = existingCode || generatedMaterialCode(index);

  return {
    masterItemCode,
    itemType: "material",
    category,
    subCategory,
    itemName,
    brand,
    specification,
    unit,
    gst: toNumber(pick(row, ["GST", "gst", "GST %", "Tax"])),
    hsnCode: cleanText(pick(row, ["HSN", "HSN Code", "hsn", "hsnCode", "HSNCode"])),
    imageUrl: defaultImageFor(category, "material"),
    referenceRate: toNumber(pick(row, ["Rate", "rate", "Price", "price", "Reference Rate", "ReferenceRate", "Basic Rate", "Unit Rate", "UnitPrice", "Amount"])),
    status: cleanText(pick(row, ["Status", "status", "Active", "active"])).toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

async function importMaterialExcel(filePath, adminCode = "admin") {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const seen = new Set();
  const imported = [];
  const skipped = [];
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const mapped = mapMaterialRow(rows[i], i);
    if (!mapped.itemName) {
      skipped.push({ rowNumber: i + 2, reason: "Missing item name" });
      continue;
    }
    const key = [mapped.itemType, mapped.itemName, mapped.brand, mapped.specification, mapped.unit, mapped.category, mapped.subCategory].join("|").toLowerCase();
    if (seen.has(key)) {
      skipped.push({ rowNumber: i + 2, reason: "Duplicate material row" });
      continue;
    }
    seen.add(key);
    try {
      imported.push(await createOrUpdateMasterItem(mapped, adminCode));
    } catch (error) {
      errors.push({ rowNumber: i + 2, masterItemCode: mapped.masterItemCode, itemName: mapped.itemName, message: error.message });
    }
  }

  return {
    success: errors.length === 0,
    sourceRows: rows.length,
    importedCount: imported.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    skipped,
    errors,
  };
}

module.exports = { importMaterialExcel, mapMaterialRow };
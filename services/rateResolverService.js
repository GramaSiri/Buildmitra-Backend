const MasterItem = require("../models/MasterItem");
const MarketRate = require("../models/MarketRate");
const NewItemRequest = require("../models/NewItemRequest");

function normalizeUnit(unit) {
  if (!unit) return "";
  const u = String(unit).trim().toUpperCase();
  if (["KG", "KGS", "KILOGRAM", "KILOGRAMS"].includes(u)) return "KG";
  if (["BAG", "BAGS", "BAG (50KG)"].includes(u)) return "BAG";
  if (["CFT", "CU.FT", "CUFT", "CUBIC FEET", "CUBIC FOOT"].includes(u)) return "CFT";
  if (["SQFT", "SQ.FT", "SFT", "SQUARE FEET", "SQ FT"].includes(u)) return "SQFT";
  if (["SQM", "SQ.M", "SQUARE METER", "SQUARE METRE", "M2", "M²"].includes(u)) return "SQM";
  if (["RFT", "RUNNING FEET", "RUNNING FOOT"].includes(u)) return "RFT";
  if (["NOS", "NO", "NUMBERS", "NUMBER", "PIECE", "PIECES", "NOS.", "PKT", "PACKET", "SET", "SETS", "LS", "L.S"].includes(u)) return u === "LS" || u === "L.S" ? "LS" : "NOS";
  if (["LTR", "LITRE", "LITER", "LITRES", "LITERS", "L"].includes(u)) return "LTR";
  if (["M", "METER", "METRE", "METERS"].includes(u)) return "M";
  if (["CUM", "CU.M", "CUBIC METER", "CUBIC METRE", "M3", "M³"].includes(u)) return "CUM";
  if (["MT", "TON", "TONNE", "METRIC TON"].includes(u)) return "MT";
  return u;
}

function cleanText(val) {
  return String(val || "").trim();
}

async function resolveSingleRate(itemInput = {}, requestedCity = "Bengaluru") {
  let code = cleanText(itemInput.masterItemCode || itemInput.itemCode || itemInput.code).toUpperCase();
  const itemName = cleanText(itemInput.itemName || itemInput.name || itemInput.materialName || itemInput.trade || itemInput.service);
  const itemType = cleanText(itemInput.itemType || itemInput.type || "material").toLowerCase();
  const rawUnit = cleanText(itemInput.unit || itemInput.uom);
  const city = cleanText(requestedCity || itemInput.city || "Bengaluru");

  // Check if code is a labour code or has primary MasterItem
  if (code) {
    const existingMaster = await MasterItem.findOne({
      $or: [{ masterItemCode: code }, { linkedLabourItemCode: code }, { primaryMasterItemCode: code }]
    }).lean();

    if (existingMaster) {
      if (existingMaster.primaryMasterItemCode && existingMaster.primaryMasterItemCode !== code) {
        code = existingMaster.primaryMasterItemCode.toUpperCase();
      } else if (existingMaster.rateComponent === "labour" || existingMaster.itemType === "labour") {
        if (existingMaster.primaryMasterItemCode) {
          code = existingMaster.primaryMasterItemCode.toUpperCase();
        }
      }
    } else if (code.startsWith("LAB-")) {
      const candidateCode = code.replace(/^LAB-?/, "");
      const matchedPrimary = await MasterItem.findOne({
        $or: [{ masterItemCode: `MAT-${candidateCode}` }, { masterItemCode: `SRV-${candidateCode}` }]
      }).lean();
      if (matchedPrimary) {
        code = matchedPrimary.masterItemCode.toUpperCase();
      }
    }
  }

  let materialRate = 0;
  let labourRate = 0;
  let resolvedRate = 0;
  let rateSource = "none";
  let status = "Rate Pending Admin Update";
  let masterItemCode = code;
  let linkedLabourItemCode = "";
  let finalItemName = itemName;
  let finalUnit = rawUnit || "NOS";
  let effectiveDate = new Date().toISOString().split("T")[0];

  // 1. Match MarketRate by masterItemCode & city
  if (code) {
    const rateDoc = await MarketRate.findOne({
      $or: [{ masterItemCode: code }, { itemCode: code }],
      approvalStatus: "approved",
      isActive: true,
      city: new RegExp(`^${city}$`, "i")
    }).lean();

    if (rateDoc && Number(rateDoc.currentRate) > 0) {
      materialRate = Number(rateDoc.currentRate);
      rateSource = "admin_market_rate";
      status = "approved";
      finalItemName = rateDoc.itemName || itemName;
      finalUnit = rateDoc.unit || finalUnit;
      effectiveDate = rateDoc.effectiveDate || effectiveDate;
      linkedLabourItemCode = rateDoc.linkedLabourItemCode || "";
    }
  }

  // 2. Match MarketRate general (any city)
  if (materialRate === 0 && code) {
    const rateDoc = await MarketRate.findOne({
      $or: [{ masterItemCode: code }, { itemCode: code }],
      approvalStatus: "approved",
      isActive: true
    }).sort({ updatedAt: -1 }).lean();

    if (rateDoc && Number(rateDoc.currentRate) > 0) {
      materialRate = Number(rateDoc.currentRate);
      rateSource = "admin_general_market_rate";
      status = "approved";
      finalItemName = rateDoc.itemName || itemName;
      finalUnit = rateDoc.unit || finalUnit;
      effectiveDate = rateDoc.effectiveDate || effectiveDate;
      linkedLabourItemCode = rateDoc.linkedLabourItemCode || "";
    }
  }

  // 3. Fallback to MasterItem referenceRate
  if (materialRate === 0 && code) {
    const masterDoc = await MasterItem.findOne({ masterItemCode: code, status: "active" }).lean();
    if (masterDoc && Number(masterDoc.referenceRate || masterDoc.rate) > 0) {
      materialRate = Number(masterDoc.referenceRate || masterDoc.rate);
      rateSource = "master_reference_rate";
      status = "approved";
      masterItemCode = masterDoc.masterItemCode;
      finalItemName = masterDoc.itemName || finalItemName;
      finalUnit = masterDoc.unit || finalUnit;
      linkedLabourItemCode = masterDoc.linkedLabourItemCode || "";
    }
  }

  // Fallback to itemName match if still 0
  if (materialRate === 0 && itemName) {
    const cleanName = itemName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const rateDoc = await MarketRate.findOne({
      itemName: new RegExp(cleanName, "i"),
      approvalStatus: "approved",
      isActive: true
    }).sort({ updatedAt: -1 }).lean();

    if (rateDoc && Number(rateDoc.currentRate) > 0) {
      materialRate = Number(rateDoc.currentRate);
      rateSource = "admin_general_market_rate";
      status = "approved";
      masterItemCode = masterItemCode || rateDoc.masterItemCode || rateDoc.itemCode;
      finalItemName = rateDoc.itemName;
      finalUnit = rateDoc.unit || finalUnit;
      effectiveDate = rateDoc.effectiveDate || effectiveDate;
      linkedLabourItemCode = rateDoc.linkedLabourItemCode || "";
    }
  }

  if (!linkedLabourItemCode && masterItemCode) {
    linkedLabourItemCode = `LAB-${masterItemCode.replace(/^(MAT|SRV|SER|PLB|ELEC|FCL)-?/, "")}`;
  }

  // Resolve Linked Labour Rate
  if (linkedLabourItemCode) {
    const labourRateDoc = await MarketRate.findOne({
      $or: [{ masterItemCode: linkedLabourItemCode }, { itemCode: linkedLabourItemCode }],
      approvalStatus: "approved",
      isActive: true
    }).lean();

    if (labourRateDoc && Number(labourRateDoc.currentRate || labourRateDoc.rate || labourRateDoc.referenceRate) > 0) {
      labourRate = Number(labourRateDoc.currentRate || labourRateDoc.rate || labourRateDoc.referenceRate);
    } else {
      const labourMaster = await MasterItem.findOne({ masterItemCode: linkedLabourItemCode, status: "active" }).lean();
      if (labourMaster && Number(labourMaster.referenceRate) > 0) {
        labourRate = Number(labourMaster.referenceRate);
      }
    }
  }

  const totalUnitRate = materialRate + labourRate;
  resolvedRate = totalUnitRate > 0 ? totalUnitRate : materialRate;

  // If no valid rate exists -> Record Admin Review Request
  if (resolvedRate === 0 || status === "Rate Pending Admin Update") {
    status = "Rate Pending Admin Update";
    rateSource = "pending_admin_update";

    if (itemName) {
      const reqCode = `REQ-RATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      try {
        await NewItemRequest.updateOne(
          { proposedItemName: itemName, itemType: itemType || "material" },
          {
            $setOnInsert: {
              requestCode: reqCode,
              proposedItemName: itemName,
              itemType: ["material", "service", "labour", "machine", "vendor"].includes(itemType) ? itemType : "material",
              brand: cleanText(itemInput.brand || ""),
              specification: cleanText(itemInput.specification || itemInput.category || ""),
              remarks: `Automated rate request for calculator/BOQ item without Admin Master rate (${city})`,
              providerUserCode: "SYSTEM_CALCULATOR",
              providerRole: "calculator_module",
              providerName: "System Rate Resolver",
              status: "pending"
            }
          },
          { upsert: true }
        );
      } catch (err) {}
    }
  }

  return {
    masterItemCode: masterItemCode || "PENDING",
    linkedLabourItemCode: linkedLabourItemCode || "",
    itemName: finalItemName || "Unknown Item",
    itemType: itemType || "material",
    unit: finalUnit || "NOS",
    materialRate,
    labourRate,
    totalUnitRate,
    resolvedRate,
    rateSource,
    city,
    effectiveDate,
    status
  };
}

async function resolveBulkRates(items = [], city = "Bengaluru") {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const results = [];
  for (const item of items) {
    const resolved = await resolveSingleRate(item, city);
    results.push(resolved);
  }
  return results;
}

async function updateCombinedBOQRate(payload = {}, adminUser = "admin") {
  let masterItemCode = cleanText(payload.masterItemCode || payload.code).toUpperCase();
  if (!masterItemCode) {
    throw new Error("masterItemCode is required");
  }

  const city = cleanText(payload.city || "Bengaluru");
  const effectiveDate = cleanText(payload.effectiveDate || new Date().toISOString().split("T")[0]);

  // If masterItemCode is a labour code or linked to primary item, find primary code
  let primaryItem = await MasterItem.findOne({
    $or: [{ masterItemCode }, { linkedLabourItemCode: masterItemCode }]
  });

  if (primaryItem && primaryItem.primaryMasterItemCode && primaryItem.primaryMasterItemCode !== masterItemCode) {
    masterItemCode = primaryItem.primaryMasterItemCode.toUpperCase();
    primaryItem = await MasterItem.findOne({ masterItemCode });
  } else if (!primaryItem && masterItemCode.startsWith("LAB-")) {
    const candidateCode = masterItemCode.replace(/^LAB-?/, "");
    const matchedPrimary = await MasterItem.findOne({
      $or: [{ masterItemCode: `MAT-${candidateCode}` }, { masterItemCode: `SRV-${candidateCode}` }]
    });
    if (matchedPrimary) {
      primaryItem = matchedPrimary;
      masterItemCode = matchedPrimary.masterItemCode;
    }
  }

  if (!primaryItem) {
    const itemType = masterItemCode.startsWith("SRV") ? "service" : masterItemCode.startsWith("LAB") ? "labour" : "material";
    primaryItem = await MasterItem.create({
      masterItemCode,
      itemType,
      category: cleanText(payload.category || "BOQ Item"),
      itemName: cleanText(payload.itemName || masterItemCode),
      unit: cleanText(payload.unit || "NOS"),
      referenceRate: Number(payload.materialRate || payload.rate || 0),
      createdBy: adminUser,
      updatedBy: adminUser
    });
  }

  const materialRate = Number(payload.materialRate ?? payload.rate ?? primaryItem.referenceRate ?? 0);
  const labourRate = Number(payload.labourRate ?? 0);
  const totalUnitRate = materialRate + labourRate;

  let linkedLabourCode = cleanText(payload.linkedLabourItemCode || primaryItem.linkedLabourItemCode).toUpperCase();
  if (!linkedLabourCode) {
    linkedLabourCode = `LAB-${masterItemCode.replace(/^(MAT|SRV|SER|PLB|ELEC|FCL)-?/, "")}`;
  }

  const updatedItemName = cleanText(payload.itemName || primaryItem.itemName);

  // 1. Update Primary MasterItem
  await MasterItem.updateOne(
    { masterItemCode },
    {
      $set: {
        referenceRate: materialRate,
        primaryMasterItemCode: masterItemCode,
        linkedLabourItemCode: linkedLabourCode,
        rateComponent: "primary",
        itemName: updatedItemName,
        unit: cleanText(payload.unit || primaryItem.unit || "NOS"),
        category: cleanText(payload.category || primaryItem.category || "General"),
        updatedBy: adminUser
      }
    }
  );

  // 2. Update Primary MarketRate
  await MarketRate.updateOne(
    { $or: [{ masterItemCode }, { itemCode: masterItemCode }] },
    {
      $set: {
        masterItemCode,
        itemCode: masterItemCode,
        itemName: updatedItemName,
        itemType: primaryItem.itemType || "material",
        category: primaryItem.category || "General",
        unit: cleanText(payload.unit || primaryItem.unit || "NOS"),
        currentRate: materialRate,
        primaryMasterItemCode: masterItemCode,
        linkedLabourItemCode: linkedLabourCode,
        rateComponent: "primary",
        city,
        approvalStatus: cleanText(payload.approvalStatus || "approved"),
        isActive: true,
        effectiveDate,
        remarks: cleanText(payload.remarks || primaryItem.specification || "")
      }
    },
    { upsert: true }
  );

  // 3. Update Linked Labour MasterItem
  const labourItemName = payload.labourItemName || `${updatedItemName} Labour`;
  await MasterItem.updateOne(
    { masterItemCode: linkedLabourCode },
    {
      $set: {
        masterItemCode: linkedLabourCode,
        itemType: "labour",
        itemName: labourItemName,
        category: primaryItem.category || "General",
        unit: cleanText(payload.unit || primaryItem.unit || "NOS"),
        referenceRate: labourRate,
        primaryMasterItemCode: masterItemCode,
        linkedLabourItemCode: linkedLabourCode,
        rateComponent: "labour",
        status: "active",
        updatedBy: adminUser
      }
    },
    { upsert: true }
  );

  // 4. Update Linked Labour MarketRate
  await MarketRate.updateOne(
    { $or: [{ masterItemCode: linkedLabourCode }, { itemCode: linkedLabourCode }] },
    {
      $set: {
        masterItemCode: linkedLabourCode,
        itemCode: linkedLabourCode,
        itemName: labourItemName,
        itemType: "labour",
        category: primaryItem.category || "General",
        unit: cleanText(payload.unit || primaryItem.unit || "NOS"),
        currentRate: labourRate,
        primaryMasterItemCode: masterItemCode,
        linkedLabourItemCode: linkedLabourCode,
        rateComponent: "labour",
        city,
        approvalStatus: cleanText(payload.approvalStatus || "approved"),
        isActive: true,
        effectiveDate,
        remarks: cleanText(payload.remarks || "")
      }
    },
    { upsert: true }
  );

  return {
    success: true,
    masterItemCode,
    linkedLabourItemCode: linkedLabourCode,
    itemName: updatedItemName,
    materialRate,
    labourRate,
    totalUnitRate,
    unit: payload.unit || primaryItem.unit || "NOS",
    city,
    effectiveDate,
    status: "approved",
    message: "BOQ Material and Labour rates saved successfully in MongoDB"
  };
}

async function searchMasterItemsWithBOQLinks(queryStr = "", city = "Bengaluru") {
  const q = cleanText(queryStr);
  if (!q) {
    return MasterItem.find({ status: "active" }).sort({ createdAt: -1 }).limit(50).lean();
  }

  const exactRegex = new RegExp(`^${q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i");
  const partialRegex = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");

  // Priority 1: Exact masterItemCode match
  const exactPrimary = await MasterItem.find({ masterItemCode: exactRegex, status: "active" }).lean();
  
  // Priority 2: Primary code matching linkedLabourItemCode or primaryMasterItemCode
  const linkedItems = await MasterItem.find({
    $or: [{ primaryMasterItemCode: exactRegex }, { linkedLabourItemCode: exactRegex }],
    status: "active"
  }).lean();

  // Priority 3: Item name partial
  const nameItems = await MasterItem.find({ itemName: partialRegex, status: "active" }).lean();

  // Priority 4: Category or specification partial
  const otherItems = await MasterItem.find({
    $or: [{ category: partialRegex }, { specification: partialRegex }, { brand: partialRegex }],
    status: "active"
  }).lean();

  const map = new Map();
  [...exactPrimary, ...linkedItems, ...nameItems, ...otherItems].forEach(item => {
    if (!map.has(item.masterItemCode)) {
      map.set(item.masterItemCode, item);
    }
  });

  return Array.from(map.values());
}

module.exports = {
  resolveSingleRate,
  resolveBulkRates,
  updateCombinedBOQRate,
  searchMasterItemsWithBOQLinks,
  normalizeUnit
};

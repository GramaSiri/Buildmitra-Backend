const Counter = require("../models/Counter");
const MasterItem = require("../models/MasterItem");
const MarketplaceListing = require("../models/MarketplaceListing");
const NewItemRequest = require("../models/NewItemRequest");
const User = require("../models/User");

const DEFAULT_IMAGES = {
  Cement: "/images/master-materials/cement.png",
  Steel: "/images/master-materials/steel.png",
  Sand: "/images/master-materials/sand.png",
  Blocks: "/images/master-materials/blocks.png",
  Tiles: "/images/master-materials/tiles.png",
  Paint: "/images/master-materials/paint.png",
  Plumbing: "/images/master-materials/plumbing.png",
  Electrical: "/images/master-materials/electrical.png",
  Hardware: "/images/master-materials/hardware.png",
  Wood: "/images/master-materials/plywood.png",
  Plywood: "/images/master-materials/plywood.png",
  Granite: "/images/master-materials/stone.png",
  Marble: "/images/master-materials/stone.png",
  Stone: "/images/master-materials/stone.png",
  Machinery: "/images/master-materials/material-default.png",
  Labour: "/images/master-materials/material-default.png",
  Service: "/images/master-materials/material-default.png",
  Vendor: "/images/master-materials/material-default.png",
  General: "/images/master-materials/material-default.png",
};

const ITEM_PREFIX = {
  material: "MAT",
  service: "SER",
  labour: "LAB",
  machine: "MAC",
  vendor: "VEN",
};

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeItemType(value) {
  const v = cleanText(value).toLowerCase();
  if (["material", "materials", "supplier"].includes(v)) return "material";
  if (["service", "services", "contractor"].includes(v)) return "service";
  if (["machine", "machinery", "machinehire", "equipment"].includes(v)) return "machine";
  if (["labour", "labor", "laboursupply", "worker"].includes(v)) return "labour";
  if (["vendor", "vendorproduct", "vendor_product", "product"].includes(v)) return "vendor";
  return "material";
}

function normalizeProviderRole(value, itemType) {
  const v = cleanText(value).toLowerCase();
  if (["supplier", "contractor", "vendor", "machinehire", "laboursupply"].includes(v)) return v;
  if (itemType === "service") return "contractor";
  if (itemType === "machine") return "machinehire";
  if (itemType === "labour") return "laboursupply";
  if (itemType === "vendor") return "vendor";
  return "supplier";
}

function defaultImageFor(category, itemType) {
  const categoryText = cleanText(category).toLowerCase();
  const found = Object.keys(DEFAULT_IMAGES).find((key) => categoryText.includes(key.toLowerCase()));
  if (found) return DEFAULT_IMAGES[found];
  if (itemType === "machine") return DEFAULT_IMAGES.Machinery;
  if (itemType === "labour") return DEFAULT_IMAGES.Labour;
  if (itemType === "service") return DEFAULT_IMAGES.Service;
  if (itemType === "vendor") return DEFAULT_IMAGES.Vendor;
  return DEFAULT_IMAGES.General;
}

async function nextCode(prefix) {
  const counter = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(6, "0")}`;
}

async function ensureMasterItemCode(itemType, suppliedCode) {
  const code = cleanText(suppliedCode).toUpperCase();
  if (code) return code;
  return nextCode(ITEM_PREFIX[itemType] || "MIT");
}

async function createOrUpdateMasterItem(body, adminCode = "admin") {
  const itemType = normalizeItemType(body.itemType);
  const masterItemCode = await ensureMasterItemCode(itemType, body.masterItemCode || body.code);
  const category = cleanText(body.category);
  const imageUrl = itemType === "material"
    ? defaultImageFor(category, itemType)
    : (cleanText(body.imageUrl) || defaultImageFor(category, itemType));

  const update = {
    masterItemCode,
    itemType,
    category,
    subCategory: cleanText(body.subCategory),
    itemName: cleanText(body.itemName || body.name || body.item),
    brand: cleanText(body.brand),
    specification: cleanText(body.specification || body.description),
    unit: cleanText(body.unit || body.uom || body.UOM),
    gst: Number(body.gst || body.GST || 0),
    hsnCode: cleanText(body.hsnCode || body.HSN || body.hsn),
    imageUrl,
    referenceRate: Number(body.referenceRate || body.price || body.rate || 0),
    status: cleanText(body.status || body.active || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    updatedBy: adminCode,
  };

  if (!update.itemName) {
    const err = new Error("itemName is required");
    err.status = 400;
    throw err;
  }

  return MasterItem.findOneAndUpdate(
    { masterItemCode },
    { $set: update, $setOnInsert: { createdBy: adminCode } },
    { new: true, upsert: true, runValidators: true }
  );
}

function buildMasterFilter(query = {}) {
  const filter = {};
  if (query.itemType) filter.itemType = normalizeItemType(query.itemType);
  if (query.category) filter.category = new RegExp(cleanText(query.category), "i");
  if (query.subCategory) filter.subCategory = new RegExp(cleanText(query.subCategory), "i");
  if (query.brand) filter.brand = new RegExp(cleanText(query.brand), "i");
  if (query.status) filter.status = cleanText(query.status).toLowerCase();
  else filter.status = "active";
  if (query.search) {
    const q = cleanText(query.search);
    filter.$or = [
      { masterItemCode: new RegExp(q, "i") },
      { itemName: new RegExp(q, "i") },
      { brand: new RegExp(q, "i") },
      { category: new RegExp(q, "i") },
      { specification: new RegExp(q, "i") },
    ];
  }
  return filter;
}

async function findUserProfile(body = {}) {
  const code = cleanText(body.providerUserCode || body.userCode || body.uniqueCode).toUpperCase();
  if (code) {
    const user = await User.findOne({ userCode: code }).select("-password");
    if (user) return user;
  }
  if (body.providerPhone || body.phone) {
    return User.findOne({ phone: cleanText(body.providerPhone || body.phone) }).select("-password");
  }
  return null;
}

function providerSnapshot(user, body = {}, itemType) {
  const providerUserCode = cleanText(user?.userCode || body.providerUserCode || body.userCode).toUpperCase();
  const providerRole = normalizeProviderRole(user?.businessRole || body.providerRole || body.role, itemType);
  const providerName = cleanText(user?.companyName || user?.name || body.providerName || body.name);
  const providerPhone = cleanText(user?.phone || user?.officePhone || body.providerPhone || body.phone);
  const providerAddress = cleanText(user?.address || body.providerAddress || body.address);
  const city = cleanText(user?.city || body.providerCity || body.city || body.location);
  const pincode = cleanText(user?.pincode || body.providerPincode || body.pincode);
  return {
    providerUserCode,
    providerRole,
    providerName,
    providerPhone,
    providerAddress,
    providerCity: city,
    providerArea: cleanText(body.providerArea || body.area || body.serviceArea),
    providerPincode: pincode,
    location: city,
    pincode,
    serviceArea: cleanText(body.serviceArea || body.area),
  };
}

async function upsertProviderListing(body = {}) {
  const masterItemCode = cleanText(body.masterItemCode || body.code).toUpperCase();
  if (!masterItemCode) {
    const err = new Error("masterItemCode is required");
    err.status = 400;
    throw err;
  }

  const masterItem = await MasterItem.findOne({ masterItemCode, status: "active" });
  if (!masterItem) {
    const err = new Error("Active master item not found");
    err.status = 404;
    throw err;
  }

  const rate = Number(body.rate || 0);
  if (!rate || rate <= 0) {
    const err = new Error("rate must be greater than zero");
    err.status = 400;
    throw err;
  }

  const user = await findUserProfile(body);
  const provider = providerSnapshot(user, body, masterItem.itemType);
  if (!provider.providerUserCode) {
    const err = new Error("providerUserCode is required");
    err.status = 400;
    throw err;
  }
  if (!provider.providerName) {
    const err = new Error("Provider profile name is required");
    err.status = 400;
    throw err;
  }

  const pending = await MarketplaceListing.findOne({
    masterItemCode,
    providerUserCode: provider.providerUserCode,
    status: "pending",
  }).sort({ createdAt: -1 });

  const base = {
    masterItemCode,
    masterItem: masterItem._id,
    itemType: masterItem.itemType,
    category: masterItem.category,
    subCategory: masterItem.subCategory,
    itemName: masterItem.itemName,
    brand: masterItem.brand,
    specification: masterItem.specification,
    description: masterItem.specification,
    unit: masterItem.unit,
    gst: masterItem.gst,
    hsnCode: masterItem.hsnCode,
    imageUrl: masterItem.imageUrl || defaultImageFor(masterItem.category, masterItem.itemType),
    rate,
    ...provider,
    documentUrl: cleanText(body.documentUrl),
    status: "pending",
    isActive: true,
    isBlocked: false,
    submittedBy: provider.providerUserCode,
    rejectedReason: "",
  };

  if (pending) {
    Object.assign(pending, base);
    pending.version = Number(pending.version || 1) + 1;
    return pending.save();
  }

  const listingCode = await nextCode("LST");
  return MarketplaceListing.create({ ...base, listingCode });
}

function buildListingFilter(query = {}, publicOnly = false) {
  const filter = {};
  if (publicOnly) {
    filter.status = "approved";
    filter.isActive = true;
    filter.isBlocked = { $ne: true };
  } else if (query.status && query.status !== "all") {
    filter.status = cleanText(query.status).toLowerCase();
  }
  if (query.itemType) filter.itemType = normalizeItemType(query.itemType);
  if (query.category) filter.category = new RegExp(cleanText(query.category), "i");
  if (query.subCategory) filter.subCategory = new RegExp(cleanText(query.subCategory), "i");
  if (query.brand) filter.brand = new RegExp(cleanText(query.brand), "i");
  if (query.city) filter.providerCity = new RegExp(cleanText(query.city), "i");
  if (query.area) filter.providerArea = new RegExp(cleanText(query.area), "i");
  if (query.pincode) filter.providerPincode = new RegExp(cleanText(query.pincode), "i");
  if (query.providerUserCode) filter.providerUserCode = cleanText(query.providerUserCode).toUpperCase();
  if (query.minPrice || query.maxPrice) {
    filter.rate = {};
    if (query.minPrice) filter.rate.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.rate.$lte = Number(query.maxPrice);
  }
  if (query.search) {
    const q = cleanText(query.search);
    filter.$or = [
      { masterItemCode: new RegExp(q, "i") },
      { itemName: new RegExp(q, "i") },
      { brand: new RegExp(q, "i") },
      { category: new RegExp(q, "i") },
      { providerName: new RegExp(q, "i") },
      { providerCity: new RegExp(q, "i") },
      { providerPincode: new RegExp(q, "i") },
    ];
  }
  return filter;
}

async function createNewItemRequest(body = {}) {
  const user = await findUserProfile(body);
  const itemType = normalizeItemType(body.itemType);
  const provider = providerSnapshot(user, body, itemType);
  if (!provider.providerUserCode) {
    const err = new Error("providerUserCode is required");
    err.status = 400;
    throw err;
  }
  const proposedItemName = cleanText(body.proposedItemName || body.itemName);
  if (!proposedItemName) {
    const err = new Error("proposedItemName is required");
    err.status = 400;
    throw err;
  }

  return NewItemRequest.create({
    requestCode: await nextCode("NIR"),
    proposedItemName,
    itemType,
    brand: cleanText(body.brand),
    specification: cleanText(body.specification),
    imageUrl: cleanText(body.imageUrl) || defaultImageFor(body.category, itemType),
    remarks: cleanText(body.remarks),
    providerUserCode: provider.providerUserCode,
    providerRole: provider.providerRole,
    providerName: provider.providerName,
    providerPhone: provider.providerPhone,
  });
}

module.exports = {
  DEFAULT_IMAGES,
  cleanText,
  normalizeItemType,
  normalizeProviderRole,
  defaultImageFor,
  createOrUpdateMasterItem,
  buildMasterFilter,
  upsertProviderListing,
  buildListingFilter,
  createNewItemRequest,
  nextCode,
};

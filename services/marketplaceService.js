const MarketRate = require("../models/MarketRate");
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
  const itemType = normalizeItemType(body.itemType || body.type || body.kind);
  const masterItemCode = await ensureMasterItemCode(itemType, body.masterItemCode || body.code || body.itemCode);
  const category = cleanText(body.category) || "General";
  const itemName = cleanText(body.itemName || body.name || body.item || body.product_name);
  const unit = cleanText(body.unit || body.uom || "NOS");
  const rate = Number(body.referenceRate ?? body.rate ?? body.price ?? body.currentRate ?? 0);

  const imageUrl = cleanText(body.imageUrl || body.productImage || body.image) || defaultImageFor(category, itemType);

  const update = {
    masterItemCode,
    itemType,
    category,
    subCategory: cleanText(body.subCategory || body.subcategory),
    itemName,
    brand: cleanText(body.brand || body.make),
    specification: cleanText(body.specification || body.spec || body.description),
    unit,
    referenceRate: rate,
    gst: Number(body.gst || 0),
    hsnCode: cleanText(body.hsnCode || body.hsn),
    imageUrl,
    status: String(body.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    createdBy: adminCode,
    updatedBy: adminCode,
  };

  const existing = await MasterItem.findOne({ masterItemCode });

  const masterItem = await MasterItem.findOneAndUpdate(
    { masterItemCode },
    { $set: update },
    { new: true, upsert: true }
  );

  if (masterItemCode && itemName) {
    await MarketRate.findOneAndUpdate(
      { $or: [{ masterItemCode }, { itemCode: masterItemCode }] },
      {
        $set: {
          masterItemCode,
          itemCode: masterItemCode,
          itemName,
          itemType,
          category,
          subCategory: update.subCategory,
          brand: update.brand,
          specification: update.specification,
          unit: update.unit,
          gst: update.gst,
          currentRate: rate,
          city: "Bengaluru",
          state: "Karnataka",
          approvalStatus: "approved",
          isActive: update.status === "active",
          sourceType: "admin_manual",
          sourceName: "BuildMitra Master Database",
          approvedBy: adminCode,
          effectiveDate: new Date().toISOString().split("T")[0]
        }
      },
      { upsert: true }
    );
  }

  return { item: masterItem, isNew: !existing };
}

async function findUserProfile(body = {}) {
  if (body.providerUserCode || body.userCode) {
    const userCode = cleanText(body.providerUserCode || body.userCode).toUpperCase();
    const user = await User.findOne({ userCode }).select("-password");
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
  const providerName = cleanText(user?.companyName || user?.name || body.providerName || body.name || body.shopName || "BuildMitra Supplier");
  const providerPhone = cleanText(user?.phone || user?.officePhone || body.providerPhone || body.phone || "");
  const providerAddress = cleanText(user?.address || body.providerAddress || body.address || "");
  const city = cleanText(user?.city || body.providerCity || body.city || body.location || "Bengaluru");
  const pincode = cleanText(user?.pincode || body.providerPincode || body.pincode || "");
  return {
    providerUserCode,
    providerRole,
    providerName,
    providerPhone,
    providerAddress,
    providerCity: city,
    providerArea: cleanText(body.providerArea || body.area || body.serviceArea || ""),
    providerPincode: pincode,
    location: city,
    pincode,
    serviceArea: cleanText(body.serviceArea || body.area || ""),
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
    const err = new Error("Active master item not found in catalogue");
    err.status = 404;
    throw err;
  }

  const inputRate = Number(body.proposedRate ?? body.rate ?? body.supplierRate ?? 0);
  const user = await findUserProfile(body);
  const provider = providerSnapshot(user, body, masterItem.itemType);
  if (!provider.providerUserCode) {
    const err = new Error("providerUserCode is required");
    err.status = 400;
    throw err;
  }

  // Stock and Commercial Fields
  const providerStock = Number(body.providerStock ?? body.stock ?? 0);
  const availability = cleanText(body.availability || (providerStock > 0 ? "In Stock" : "In Stock"));
  const minOrderQty = Number(body.minOrderQty ?? body.moq ?? 1);
  const deliveryTime = cleanText(body.deliveryTime || "");
  const deliveryArea = cleanText(body.deliveryArea || body.pincode || provider.pincode || "");
  const gst = Number(body.gst ?? masterItem.gst ?? 0);
  const transport = cleanText(body.transport || "");
  const remarks = cleanText(body.remarks || "");

  // Handle Images
  const rawImages = Array.isArray(body.images) ? body.images : [];
  let formattedImages = rawImages.map((img, idx) => {
    if (typeof img === "string") {
      return { url: img, isPrimary: idx === 0, alt: masterItem.itemName };
    }
    return {
      url: cleanText(img.url || img.imageUrl || img.image),
      publicId: cleanText(img.publicId || ""),
      alt: cleanText(img.alt || masterItem.itemName),
      isPrimary: Boolean(img.isPrimary || idx === 0)
    };
  }).filter((img) => img.url);

  const customSingleUrl = cleanText(body.imageUrl || body.productImage || body.image);
  if (customSingleUrl && !formattedImages.some((i) => i.url === customSingleUrl)) {
    formattedImages.unshift({
      url: customSingleUrl,
      publicId: "",
      alt: masterItem.itemName,
      isPrimary: true
    });
  }

  if (formattedImages.length === 0 && masterItem.imageUrl) {
    formattedImages.push({
      url: masterItem.imageUrl,
      publicId: "",
      alt: masterItem.itemName,
      isPrimary: true
    });
  }

  const primaryObj = formattedImages.find((i) => i.isPrimary) || formattedImages[0];
  const finalImageUrl = primaryObj ? primaryObj.url : defaultImageFor(masterItem.category, masterItem.itemType);

  // Look for ANY existing record for (providerUserCode, masterItemCode)
  const existing = await MarketplaceListing.findOne({
    masterItemCode,
    providerUserCode: provider.providerUserCode,
    isArchived: { $ne: true }
  });

  if (existing) {
    // Single Record Retained!
    const currentApprovedRate = Number(existing.approvedRate || (existing.status === "approved" ? existing.rate : 0));
    
    // Check if input rate represents a price change request
    const isRateChanged = inputRate > 0 && inputRate !== currentApprovedRate && inputRate !== existing.proposedRate;
    
    if (isRateChanged || (inputRate > 0 && existing.status === "rejected")) {
      // RATE SAFETY:
      // Preserve existing approvedRate & live rate intact!
      // Proposed rate goes to proposedRate + status = pending.
      existing.proposedRate = inputRate;
      existing.status = "pending";
      existing.approvalStatus = "pending";

      if (currentApprovedRate > 0) {
        existing.approvedRate = currentApprovedRate;
        existing.rate = currentApprovedRate; // LIVE rate remains at approved rate (e.g. ₹390)!
      } else {
        existing.approvedRate = 0;
        existing.rate = inputRate;
      }
    } else if (inputRate > 0 && existing.status === "pending") {
      existing.proposedRate = inputRate;
    }

    // Availability & Commercial fields (can update immediately)
    existing.providerStock = providerStock;
    existing.availability = availability;
    existing.minOrderQty = minOrderQty;
    existing.deliveryTime = deliveryTime;
    existing.deliveryArea = deliveryArea;
    existing.gst = gst;
    existing.transport = transport;
    existing.remarks = remarks;

    // Update images if new ones provided
    if (formattedImages.length > 0) {
      existing.images = formattedImages;
      existing.imageUrl = finalImageUrl;
    }

    Object.assign(existing, provider);
    existing.version = Number(existing.version || 1) + 1;
    return existing.save();
  }

  // Create NEW single record for provider + masterItemCode
  if (!inputRate || inputRate <= 0) {
    const err = new Error("Rate must be greater than zero");
    err.status = 400;
    throw err;
  }

  const listingCode = await nextCode("LST");
  return MarketplaceListing.create({
    listingCode,
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
    gst,
    hsnCode: masterItem.hsnCode,
    imageUrl: finalImageUrl,
    images: formattedImages.length > 0 ? formattedImages : [{ url: finalImageUrl, isPrimary: true, alt: masterItem.itemName }],
    
    // Rate Safety fields
    rate: inputRate,
    proposedRate: inputRate,
    approvedRate: 0,
    status: "pending",
    approvalStatus: "pending",

    // Stock & Commercial fields
    providerStock,
    availability,
    minOrderQty,
    deliveryTime,
    deliveryArea,
    transport,
    remarks,

    ...provider,
    documentUrl: cleanText(body.documentUrl),
    isActive: true,
    isBlocked: false,
    isArchived: false,
    submittedBy: provider.providerUserCode,
    rejectedReason: ""
  });
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
  /*
   * Location matching:
   * - PIN code = exact normalized 6-digit match
   * - City / Area = case-insensitive
   * - Legacy listing location/address fields are supported
   * - City + Area + PIN combine as refinements
   */
  const locationClauses = [];

  if (query.city) {
    const city = cleanText(query.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (city) {
      const cityRegex = new RegExp(city, "i");

      locationClauses.push({
        $or: [
          { providerCity: cityRegex },
          { location: cityRegex },
          { providerAddress: cityRegex },
        ],
      });
    }
  }

  if (query.area) {
    const area = cleanText(query.area).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (area) {
      const areaRegex = new RegExp(area, "i");

      locationClauses.push({
        $or: [
          { providerArea: areaRegex },
          { serviceArea: areaRegex },
          { location: areaRegex },
          { providerAddress: areaRegex },
        ],
      });
    }
  }

  if (query.pincode) {
    const pincode = cleanText(query.pincode)
      .replace(/\D/g, "")
      .slice(-6);

    if (pincode.length === 6) {
      locationClauses.push({
        $or: [
          { providerPincode: pincode },
          { pincode },
        ],
      });
    }
  }

  if (locationClauses.length) {
    filter.$and = [...(filter.$and || []), ...locationClauses];
  }
  if (query.providerUserCode) filter.providerUserCode = cleanText(query.providerUserCode).toUpperCase();
  if (query.minPrice || query.maxPrice) {
    filter.rate = {};
    if (query.minPrice) filter.rate.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.rate.$lte = Number(query.maxPrice);
  }
  if (query.search) {
    const q = cleanText(query.search);
    filter.$or = [
      { itemName: new RegExp(q, "i") },
      { masterItemCode: new RegExp(q, "i") },
      { brand: new RegExp(q, "i") },
      { category: new RegExp(q, "i") },
      { providerName: new RegExp(q, "i") },
      { providerCity: new RegExp(q, "i") },
    ];
  }
  return filter;
}

async function createNewItemRequest(body = {}) {
  const proposedItemName = cleanText(body.proposedItemName || body.itemName || body.name);
  if (!proposedItemName) {
    const err = new Error("proposedItemName is required");
    err.status = 400;
    throw err;
  }
  const user = await findUserProfile(body);
  const provider = providerSnapshot(user, body, body.itemType);
  if (!provider.providerUserCode) {
    const err = new Error("providerUserCode is required");
    err.status = 400;
    throw err;
  }
  const requestCode = await nextCode("REQ");
  return NewItemRequest.create({
    requestCode,
    itemType: normalizeItemType(body.itemType),
    category: cleanText(body.category),
    subCategory: cleanText(body.subCategory),
    proposedItemName,
    brand: cleanText(body.brand),
    specification: cleanText(body.specification),
    unit: cleanText(body.unit),
    imageUrl: cleanText(body.imageUrl),
    images: Array.isArray(body.images) ? body.images : (body.imageUrl ? [{ url: body.imageUrl, isPrimary: true }] : []),
    remarks: cleanText(body.remarks),
    ...provider,
    status: "pending",
  });
}

module.exports = {
  createOrUpdateMasterItem,
  upsertProviderListing,
  buildMasterFilter: (query = {}) => {
    const filter = {};
    if (query.status && query.status !== "all") filter.status = cleanText(query.status).toLowerCase();
    if (query.itemType) filter.itemType = normalizeItemType(query.itemType);
    if (query.category) filter.category = new RegExp(cleanText(query.category), "i");
    if (query.subCategory) filter.subCategory = new RegExp(cleanText(query.subCategory), "i");
    if (query.brand) filter.brand = new RegExp(cleanText(query.brand), "i");
    if (query.search) {
      const q = cleanText(query.search);
      filter.$or = [
        { itemName: new RegExp(q, "i") },
        { masterItemCode: new RegExp(q, "i") },
        { brand: new RegExp(q, "i") },
        { category: new RegExp(q, "i") },
      ];
    }
    return filter;
  },
  buildListingFilter,
  createNewItemRequest,
};


const express = require("express");
const router = express.Router();
const MarketplaceListing = require("../models/MarketplaceListing");
const MasterItem = require("../models/MasterItem");
const NewItemRequest = require("../models/NewItemRequest");
const User = require("../models/User");
const {
  buildListingFilter,
  buildMasterFilter,
  createNewItemRequest,
  upsertProviderListing,
} = require("../services/marketplaceService");

router.get("/master-items", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const filter = buildMasterFilter(req.query);
    const [items, total] = await Promise.all([
      MasterItem.find(filter).sort({ category: 1, itemName: 1 }).skip((page - 1) * limit).limit(limit),
      MasterItem.countDocuments(filter),
    ]);
    res.json({ success: true, items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post("/listing", async (req, res) => {
  try {
    const listing = await upsertProviderListing(req.body || {});
    res.json({ success: true, message: "Listing submitted for admin approval", listing });
  } catch (error) {
    console.error("Provider listing error:", error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post("/marketplace-listings", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.items) ? req.body.items : [];
    const provider = req.body?.provider || {};
    const listings = [];
    const errors = [];
    for (const row of rows) {
      try {
        listings.push(await upsertProviderListing({ ...provider, ...row }));
      } catch (error) {
        errors.push({ masterItemCode: row.masterItemCode, message: error.message });
      }
    }
    res.json({ success: errors.length === 0, listings, errors });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get("/my-listings/:providerUserCode", async (req, res) => {
  try {
    const listings = await MarketplaceListing.find({
      providerUserCode: String(req.params.providerUserCode || "").toUpperCase(),
    }).sort({ createdAt: -1 });
    res.json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/marketplace-listings", async (req, res) => {
  try {
    const sort = req.query.sort === "lowest" ? { rate: 1 } : { createdAt: -1 };
    const listings = await MarketplaceListing.find(buildListingFilter(req.query, true)).sort(sort).limit(200);
    res.json({ success: true, count: listings.length, listings });
  } catch (error) {
    console.error("Provider marketplace listings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/public-profile/:providerUserCode", async (req, res) => {
  try {
    const providerUserCode = String(req.params.providerUserCode || "").toUpperCase();
    const [user, listings] = await Promise.all([
      User.findOne({ userCode: providerUserCode }).select("-password"),
      MarketplaceListing.find(buildListingFilter({ providerUserCode }, true)).sort({ category: 1, itemName: 1 }),
    ]);

    const first = listings[0] || {};
    const profile = user
      ? {
          providerUserCode: user.userCode,
          providerName: user.companyName || user.name,
          providerPhone: user.phone || user.officePhone || "",
          providerRole: user.businessRole,
          providerAddress: user.address || "",
          providerCity: user.city || "",
          providerArea: "",
          providerPincode: user.pincode || "",
          isVerified: Boolean(user.isVerified),
        }
      : {
          providerUserCode,
          providerName: first.providerName || "BuildMitra Provider",
          providerPhone: first.providerPhone || "",
          providerRole: first.providerRole || "",
          providerAddress: first.providerAddress || "",
          providerCity: first.providerCity || first.location || "",
          providerArea: first.providerArea || first.serviceArea || "",
          providerPincode: first.providerPincode || first.pincode || "",
          isVerified: true,
        };

    res.json({ success: true, profile, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/new-item-request", async (req, res) => {
  try {
    const request = await createNewItemRequest(req.body || {});
    res.json({ success: true, message: "New item request sent to admin", request });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get("/new-item-requests/:providerUserCode", async (req, res) => {
  try {
    const requests = await NewItemRequest.find({
      providerUserCode: String(req.params.providerUserCode || "").toUpperCase(),
    }).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

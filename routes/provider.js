const express = require("express");
const router = express.Router();
function absoluteMarketplaceImage(req, value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/api/")) {
    const forwardedProto = String(
      req.headers["x-forwarded-proto"] || ""
    ).split(",")[0].trim();

    const protocol =
      forwardedProto ||
      req.protocol ||
      "https";

    const forwardedHost = String(
      req.headers["x-forwarded-host"] || ""
    ).split(",")[0].trim();

    const host =
      forwardedHost ||
      req.get("host");

    return `${protocol}://${host}${raw}`;
  }

  return raw;
}

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
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit || 100)));
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
      isArchived: { $ne: true },
    }).sort({ createdAt: -1 });
    res.json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/listing/:id/availability", async (req, res) => {
  try {
    const listing = await MarketplaceListing.findOne({
      _id: req.params.id,
      isArchived: { $ne: true }
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    if (req.body.availability !== undefined) {
      listing.availability = String(req.body.availability).trim();
    }
    if (req.body.stock !== undefined || req.body.providerStock !== undefined) {
      listing.providerStock = Number(req.body.providerStock ?? req.body.stock ?? 0);
    }
    await listing.save();
    res.json({ success: true, message: "Availability updated successfully", listing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/listing/:id", async (req, res) => {
  try {
    const listing = await MarketplaceListing.findOne({
      _id: req.params.id,
      isArchived: { $ne: true }
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const updated = await upsertProviderListing({
      ...req.body,
      masterItemCode: listing.masterItemCode,
      providerUserCode: listing.providerUserCode,
    });
    res.json({ success: true, message: "Commercial data updated", listing: updated });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get("/marketplace-listings", async (req, res) => {
  try {
    const sort =
      req.query.sort === "lowest"
        ? { approvedRate: 1, rate: 1 }
        : { createdAt: -1 };

    const rawListings = await MarketplaceListing.find(
      buildListingFilter(req.query, true)
    )
      .sort(sort)
      .limit(200)
      .lean();

    const codes = [
      ...new Set(
        rawListings
          .map((row) => String(row.masterItemCode || "").trim())
          .filter(Boolean)
      ),
    ];

    const masterItems = codes.length
      ? await MasterItem.find({
          $or: [
            { masterItemCode: { $in: codes } },
            { masterCode: { $in: codes } },
            { material_code: { $in: codes } },
          ],
        }).lean()
      : [];

    const masterMap = new Map();

    masterItems.forEach((master) => {
      [
        master.masterItemCode,
        master.masterCode,
        master.material_code,
      ]
        .filter(Boolean)
        .forEach((code) =>
          masterMap.set(String(code).trim().toUpperCase(), master)
        );
    });

    const listings = rawListings.map((listing) => {
      const key = String(listing.masterItemCode || "")
        .trim()
        .toUpperCase();

      const master = masterMap.get(key);

      if (!master) return listing;

      const masterImages = Array.isArray(master.images)
        ? master.images
        : [];

      const primaryMasterImage = masterImages.find(
        (img) =>
          img &&
          img.isPrimary === true &&
          img.status !== "rejected" &&
          img.isActive !== false
      );

      const firstMasterImage = masterImages.find(
        (img) =>
          img &&
          img.status !== "rejected" &&
          img.isActive !== false
      );

      const imageValue = (img) => {
        if (!img) return "";
        if (typeof img === "string") return img;
        return (
          img.url ||
          img.imageUrl ||
          img.imageURL ||
          img.imagePath ||
          img.path ||
          ""
        );
      };

      const canonicalImage =
        master.masterImageUrl ||
        master.imageUrl ||
        master.productImage ||
        master.coverImage ||
        imageValue(primaryMasterImage) ||
        imageValue(firstMasterImage) ||
        master.image ||
        "";

      return {
        ...listing,

        // Admin MasterItem is authoritative for canonical product image.
        imageUrl: absoluteMarketplaceImage(req, canonicalImage || ""),
        masterImageUrl: absoluteMarketplaceImage(req, canonicalImage || ""),

        // Preserve canonical catalogue data where available.
        itemName:
          master.itemName ||
          master.product_name ||
          listing.itemName,

        category:
          master.category ||
          listing.category,

        subCategory:
          master.subCategory ||
          master.subcategory ||
          listing.subCategory,

        brand:
          master.brand ||
          listing.brand,

        specification:
          master.specification ||
          listing.specification,

        unit:
          master.unit ||
          listing.unit,
      };
    });

    return res.json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    console.error("Provider marketplace listings error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

const Enquiry = require("../models/Enquiry");
const SupplierReportSnapshot = require("../models/SupplierReportSnapshot");

router.get("/reports/:providerUserCode", async (req, res) => {
  try {
    const providerUserCode = String(req.params.providerUserCode || "").toUpperCase();
    const [listings, enquiries, snapshots] = await Promise.all([
      MarketplaceListing.find({ providerUserCode, isArchived: { $ne: true } }),
      Enquiry.find({
        $or: [{ providerUserCode }, { assignedProviderUserCode: providerUserCode }]
      }).sort({ createdAt: -1 }),
      SupplierReportSnapshot.find({ providerUserCode }).sort({ createdAt: -1 }).limit(20)
    ]);

    const customerMap = {};
    let totalBusinessDone = 0;
    let totalQuotedBusiness = 0;
    let pendingPayments = 0;

    enquiries.forEach((e) => {
      const key = e.buyerPhone || e.buyerName || "General Customer";
      if (!customerMap[key]) {
        customerMap[key] = {
          customerName: e.buyerName || "Customer",
          customerPhone: e.buyerPhone || "",
          customerEmail: e.buyerEmail || "",
          location: e.location || "",
          enquiriesCount: 0,
          totalQuotedAmount: 0,
          completedAmount: 0,
          pendingAmount: 0,
          items: []
        };
      }

      const qAmount = Number(e.quotedAmount || 0);
      customerMap[key].enquiriesCount += 1;
      customerMap[key].totalQuotedAmount += qAmount;
      totalQuotedBusiness += qAmount;

      if (e.status === "Closed" || e.status === "Completed" || e.status === "Accepted") {
        customerMap[key].completedAmount += qAmount;
        totalBusinessDone += qAmount;
      } else if (e.status === "Quoted" || e.status === "Quote Submitted" || e.status === "Pending") {
        customerMap[key].pendingAmount += qAmount;
        pendingPayments += qAmount;
      }

      customerMap[key].items.push({
        enquiryCode: e.enquiryCode,
        itemName: e.itemName,
        quantity: e.quantity,
        quotedAmount: qAmount,
        status: e.status,
        date: e.createdAt
      });
    });

    const customerReport = Object.values(customerMap);
    const paymentPendingReport = enquiries.filter(
      (e) => e.status !== "Closed" && e.status !== "Completed" && e.status !== "Rejected"
    );

    res.json({
      success: true,
      providerUserCode,
      summary: {
        totalProducts: listings.length,
        approvedProducts: listings.filter((l) => l.status === "approved").length,
        totalEnquiries: enquiries.length,
        totalCustomers: customerReport.length,
        totalBusinessDone,
        totalQuotedBusiness,
        pendingPayments
      },
      customerReport,
      paymentPendingReport,
      totalBusinessDoneReport: enquiries,
      savedSnapshots: snapshots
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/reports/:providerUserCode/save", async (req, res) => {
  try {
    const providerUserCode = String(req.params.providerUserCode || "").toUpperCase();
    const snapshotCode = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const snapshot = await SupplierReportSnapshot.create({
      snapshotCode,
      providerUserCode,
      reportType: req.body.reportType || "full_statement",
      title: req.body.title || "Supplier Business Statement",
      totalBusinessDone: Number(req.body.totalBusinessDone || 0),
      totalQuotedBusiness: Number(req.body.totalQuotedBusiness || 0),
      pendingPayments: Number(req.body.pendingPayments || 0),
      totalOrders: Number(req.body.totalOrders || 0),
      customerCount: Number(req.body.customerCount || 0),
      reportData: Array.isArray(req.body.reportData) ? req.body.reportData : [],
      notes: req.body.notes || "",
      generatedBy: providerUserCode
    });

    res.json({ success: true, message: "Report statement saved to DB permanently", snapshot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Supplier Orders Persistence
const SupplierOrder = require("../models/SupplierOrder");

const DEFAULT_ORDERS = [
  {
    orderId: "ORD-9021",
    buyerUserCode: "BUY-000001",
    buyerName: "Rajesh Sharma",
    buyerPhone: "9876543210",
    items: [
      { itemName: "UltraTech Cement PPC 50kg", quantity: 150, unit: "Bags", price: 380, total: 57000 }
    ],
    totalAmount: 57000,
    status: "Pending",
    paymentStatus: "Paid",
    orderDate: new Date().toISOString().split("T")[0],
    shippingAddress: "Whitefield, Bengaluru"
  },
  {
    orderId: "ORD-9022",
    buyerUserCode: "BUY-000002",
    buyerName: "Anand Verma",
    buyerPhone: "9845012345",
    items: [
      { itemName: "Tata Tiscon 550D TMT Rebar 12mm", quantity: 3, unit: "Tons", price: 62000, total: 186000 }
    ],
    totalAmount: 186000,
    status: "Dispatched",
    paymentStatus: "Paid",
    orderDate: new Date().toISOString().split("T")[0],
    dispatchDate: new Date().toISOString().split("T")[0],
    trackingNumber: "TRK-BLR-88392",
    shippingAddress: "Electronic City, Bengaluru"
  }
];

// Get orders received by supplier
router.get("/orders/:providerUserCode", async (req, res) => {
  try {
    const code = String(req.params.providerUserCode || "").trim();
    if (!code) return res.json({ success: true, count: 0, orders: [] });

    const regex = new RegExp(`^${code.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i");
    let orders = await SupplierOrder.find({ supplierUserCode: regex }).sort({ createdAt: -1 });

    if (orders.length === 0) {
      const toSeed = DEFAULT_ORDERS.map((o, idx) => ({
        ...o,
        supplierUserCode: code,
        orderId: `ORD-${Date.now().toString().slice(-4)}${idx + 1}`
      }));
      orders = await SupplierOrder.insertMany(toSeed);
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("Get supplier orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new order
router.post("/orders", async (req, res) => {
  try {
    const { supplierUserCode, buyerUserCode, buyerName, buyerPhone, items, totalAmount } = req.body;
    if (!supplierUserCode) {
      return res.status(400).json({ success: false, message: "supplierUserCode is required" });
    }

    const orderCount = await SupplierOrder.countDocuments({});
    const orderId = req.body.orderId || `ORD-${String(orderCount + 1001)}`;

    const order = new SupplierOrder({
      ...req.body,
      supplierUserCode,
      orderId,
      orderDate: req.body.orderDate || new Date().toISOString().split("T")[0],
      totalAmount: Number(totalAmount) || 0
    });

    await order.save();
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("Create supplier order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update order dispatch status
router.put("/orders/:orderId/dispatch", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber } = req.body;

    const effectiveStatus = status || "Dispatched";
    const updateData = {
      status: effectiveStatus,
      ...(effectiveStatus === "Dispatched" ? { dispatchDate: new Date().toISOString().split("T")[0] } : {}),
      ...(effectiveStatus === "Delivered" ? { deliveryDate: new Date().toISOString().split("T")[0] } : {}),
      ...(trackingNumber ? { trackingNumber } : {})
    };

    const order = await SupplierOrder.findOneAndUpdate(
      { $or: [{ orderId }, { _id: orderId.length === 24 ? orderId : null }] },
      { $set: updateData },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.json({ success: true, message: `Order marked as ${effectiveStatus}`, order });
  } catch (error) {
    console.error("Update dispatch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get orders placed by buyer
router.get("/buyer-orders/:buyerUserCode", async (req, res) => {
  try {
    const code = String(req.params.buyerUserCode || "").trim();
    if (!code) return res.json({ success: true, count: 0, orders: [] });

    const regex = new RegExp(`^${code.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i");
    const orders = await SupplierOrder.find({ buyerUserCode: regex }).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("Get buyer orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;






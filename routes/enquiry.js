const express = require("express");
const Quote = require("../models/Quote");
const router = express.Router();

const Enquiry = require("../models/Enquiry");
const MarketplaceListing = require("../models/MarketplaceListing");
const RealEstateProperty = require("../models/RealEstateProperty");
const User = require("../models/User");

function text(value) {
  return String(value || "").trim();
}

function normalisePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function validPhone(value) {
  const phone = normalisePhone(value);
  return phone.length >= 10 && phone.length <= 15;
}

function configuredAdminPhone() {
  const phone = normalisePhone(
    process.env.ADMIN_ENQUIRY_PHONE || process.env.ADMIN_REAL_ESTATE_PHONE
  );
  return validPhone(phone) ? phone : "";
}

function requireAdmin(req, res, next) {
  if (String(req.headers["x-user-role"] || "").toLowerCase() !== "admin") {
    return res.status(403).json({ success: false, message: "Admin required" });
  }
  next();
}

function requireUserCode(req, res, next) {
  const userCode = text(
    req.headers["x-user-code"] ||
    req.query.providerUserCode ||
    req.query.buyerUserCode ||
    req.query.userCode ||
    req.body.userCode ||
    req.body.providerUserCode ||
    req.body.buyerUserCode
  );
  if (!userCode) {
    return res.status(401).json({ success: false, message: "x-user-code is required" });
  }
  req.userCode = userCode;
  next();
}

function maskPhone(value) {
  const phone = normalisePhone(value);
  if (phone.length < 4) return "**********";
  return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

function hideBuyerContact(enquiry) {
  const doc = typeof enquiry.toObject === "function" ? enquiry.toObject() : { ...enquiry };
  doc.buyerPhone = maskPhone(doc.buyerPhone);
  doc.buyerEmail = doc.buyerEmail ? "Hidden until Admin approval" : "";
  return doc;
}

async function nextEnquiryCode() {
  const last = await Enquiry.findOne({ enquiryCode: /^ENQ-\d{6}$/ })
    .sort({ enquiryCode: -1 })
    .select("enquiryCode")
    .lean();
  const number = last ? Number(String(last.enquiryCode).replace("ENQ-", "")) : 0;
  return `ENQ-${String(number + 1).padStart(6, "0")}`;
}

async function resolveProvider(reqBody, isRealEstate) {
  if (isRealEstate) {
    const propertyCode = text(reqBody.propertyCode);
    if (!propertyCode) {
      const error = new Error("propertyCode is required for Real Estate enquiry");
      error.status = 400;
      throw error;
    }

    const property = await RealEstateProperty.findOne({
      propertyCode,
      status: "approved",
      isActive: true,
      isBlocked: false,
    }).lean();

    if (!property) {
      const error = new Error("Approved property not found");
      error.status = 404;
      throw error;
    }

    return {
      enquiryCategory: "realestate",
      propertyCode: property.propertyCode,
      listingCode: "",
      itemType: "realestate",
      itemName: property.title,
      providerUserCode: property.providerUserCode,
      providerRole: property.providerRole || "realestate",
      providerName: property.providerName,
      providerPhone: property.providerPhone,
      location: text(reqBody.location) || [property.area, property.city].filter(Boolean).join(", "),
      pincode: text(reqBody.pincode) || text(property.pincode),
    };
  }

  const providerUserCode = text(reqBody.providerUserCode);
  if (!providerUserCode) {
    const error = new Error("providerUserCode is required");
    error.status = 400;
    throw error;
  }

  return {
    enquiryCategory: ["marketplace", "general"].includes(text(reqBody.enquiryCategory).toLowerCase())
      ? text(reqBody.enquiryCategory).toLowerCase()
      : "marketplace",
    propertyCode: "",
    listingCode: text(reqBody.listingCode),
    itemType: text(reqBody.itemType),
    itemName: text(reqBody.itemName),
    providerUserCode,
    providerRole: text(reqBody.providerRole),
    providerName: text(reqBody.providerName),
    providerPhone: text(reqBody.providerPhone),
    location: text(reqBody.location),
    pincode: text(reqBody.pincode),
  };
}

// PUBLIC CREATE: every enquiry goes only to Admin first.
router.post("/", async (req, res) => {
  try {
    const buyerName = text(req.body.buyerName);
    const buyerPhone = normalisePhone(req.body.buyerPhone);

    if (!buyerName) {
      return res.status(400).json({ success: false, message: "buyerName is required" });
    }
    if (!validPhone(buyerPhone)) {
      return res.status(400).json({ success: false, message: "Valid buyerPhone is required" });
    }

    const isRealEstate =
      text(req.body.enquiryCategory).toLowerCase() === "realestate" ||
      text(req.body.itemType).toLowerCase() === "realestate" ||
      Boolean(text(req.body.propertyCode));

    const provider = await resolveProvider(req.body, isRealEstate);
    const adminPhone = configuredAdminPhone();

    /*
      Marketplace product enquiries already contain the exact supplier
      selected by the buyer. Route those directly to that supplier.

      Real-estate / generic enquiries retain the existing Admin-first flow.
    */
    const directMarketplaceSupplier =
      !isRealEstate &&
      Boolean(provider.providerUserCode) &&
      Boolean(text(req.body.listingCode) || text(req.body.masterItemCode));

    const enquiry = await Enquiry.create({
      ...req.body,
      ...provider,

      enquiryCode: await nextEnquiryCode(),

      buyerName,
      buyerPhone,
      buyerEmail: text(req.body.buyerEmail),

      adminPhone,

      contactRoute: directMarketplaceSupplier ? "provider" : "admin",

      adminApprovalStatus: directMarketplaceSupplier
        ? "assigned"
        : "pending_admin",

      contactReleased: directMarketplaceSupplier,

      status: directMarketplaceSupplier ? "Pending" : "Pending Admin",

      assignedProviderUserCode: directMarketplaceSupplier
        ? provider.providerUserCode
        : "",

      assignedProviderName: directMarketplaceSupplier
        ? provider.providerName || ""
        : "",

      assignedProviderPhone: directMarketplaceSupplier
        ? provider.providerPhone || ""
        : "",
    });

    if (isRealEstate) {
      await RealEstateProperty.updateOne(
        { propertyCode: enquiry.propertyCode },
        { $inc: { enquiryCount: 1 } }
      );
    }

    return res.status(201).json({
      success: true,
      enquiryCode: enquiry.enquiryCode,
      enquiry: hideBuyerContact(enquiry),
      contactPhone: adminPhone,
      routingMessage: "Enquiry submitted to BuildMitra Admin for review and assignment.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

// ADMIN: complete queue for every category.
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.adminApprovalStatus) filter.adminApprovalStatus = req.query.adminApprovalStatus;
    if (req.query.enquiryCategory) filter.enquiryCategory = req.query.enquiryCategory;
    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/realestate", requireAdmin, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ enquiryCategory: "realestate" })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ADMIN: approve and release to original uploader.
router.put("/admin/:enquiryCode/approve-uploader", requireAdmin, async (req, res) => {
  try {
    const existing = await Enquiry.findOne({ enquiryCode: req.params.enquiryCode });
    if (!existing) return res.status(404).json({ success: false, message: "Enquiry not found" });

    const phone = normalisePhone(existing.providerPhone);
    if (!existing.providerUserCode || !validPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Original uploader does not have a valid user code and phone number",
      });
    }

    const now = new Date();
    existing.adminApprovalStatus = "approved";
    existing.adminRemarks = text(req.body.adminRemarks);
    existing.reviewedBy = text(req.body.reviewedBy) || "admin";
    existing.reviewedAt = now;
    existing.assignedProviderUserCode = existing.providerUserCode;
    existing.assignedProviderRole = existing.providerRole;
    existing.assignedProviderName = existing.providerName;
    existing.assignedProviderPhone = phone;
    existing.assignedBy = existing.reviewedBy;
    existing.assignedAt = now;
    existing.contactReleased = true;
    existing.contactReleasedAt = now;
    existing.contactRoute = "provider";
    existing.status = "Approved";
    await existing.save();

    return res.json({ success: true, enquiry: existing, message: "Approved and released to original uploader" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ADMIN: assign to any active registered provider/user.
router.put("/admin/:enquiryCode/assign", requireAdmin, async (req, res) => {
  try {
    const targetUserCode = text(req.body.targetUserCode);
    if (!targetUserCode) {
      return res.status(400).json({ success: false, message: "targetUserCode is required" });
    }

    const targetUser = await User.findOne({ userCode: targetUserCode, isActive: { $ne: false } })
      .select("-password")
      .lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Active registered user not found" });
    }

    const phone = normalisePhone(targetUser.phone);
    if (!validPhone(phone)) {
      return res.status(400).json({ success: false, message: "Selected user has no valid phone number" });
    }

    const now = new Date();
    const adminCode = text(req.body.assignedBy) || "admin";
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      {
        adminApprovalStatus: "assigned",
        adminRemarks: text(req.body.adminRemarks),
        reviewedBy: adminCode,
        reviewedAt: now,
        assignedProviderUserCode: targetUser.userCode,
        assignedProviderRole: targetUser.businessRole || targetUser.role || "",
        assignedProviderName: targetUser.name || "",
        assignedProviderPhone: phone,
        assignedBy: adminCode,
        assignedAt: now,
        contactReleased: true,
        contactReleasedAt: now,
        contactRoute: "forwarded-user",
        forwardedToUserCode: targetUser.userCode,
        forwardedToName: targetUser.name || "",
        forwardedToPhone: phone,
        forwardedBy: adminCode,
        forwardedAt: now,
        status: "Assigned",
      },
      { new: true, runValidators: true }
    );

    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.json({ success: true, enquiry, message: "Enquiry assigned and buyer contact released" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Compatibility with old Real Estate admin button.
router.put("/admin/:enquiryCode/forward", requireAdmin, async (req, res) => {
  req.body.targetUserCode = req.body.targetUserCode;
  try {
    const targetUserCode = text(req.body.targetUserCode);
    if (!targetUserCode) return res.status(400).json({ success: false, message: "targetUserCode is required" });

    const targetUser = await User.findOne({ userCode: targetUserCode, isActive: { $ne: false } })
      .select("-password")
      .lean();
    if (!targetUser) return res.status(404).json({ success: false, message: "Active registered user not found" });

    const phone = normalisePhone(targetUser.phone);
    if (!validPhone(phone)) return res.status(400).json({ success: false, message: "Selected user has no valid phone number" });

    const now = new Date();
    const adminCode = text(req.body.forwardedBy) || "admin";
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      {
        adminApprovalStatus: "assigned",
        adminRemarks: text(req.body.adminRemarks),
        reviewedBy: adminCode,
        reviewedAt: now,
        assignedProviderUserCode: targetUser.userCode,
        assignedProviderRole: targetUser.businessRole || targetUser.role || "",
        assignedProviderName: targetUser.name || "",
        assignedProviderPhone: phone,
        assignedBy: adminCode,
        assignedAt: now,
        contactReleased: true,
        contactReleasedAt: now,
        contactRoute: "forwarded-user",
        forwardedToUserCode: targetUser.userCode,
        forwardedToName: targetUser.name || "",
        forwardedToPhone: phone,
        forwardedBy: adminCode,
        forwardedAt: now,
        status: "Assigned",
      },
      { new: true, runValidators: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.json({ success: true, enquiry, contactPhone: phone, message: "Enquiry assigned and released" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/admin/:enquiryCode/hold", requireAdmin, async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      {
        adminApprovalStatus: "hold",
        adminRemarks: text(req.body.adminRemarks),
        reviewedBy: text(req.body.reviewedBy) || "admin",
        reviewedAt: new Date(),
        contactReleased: false,
        contactRoute: "admin",
        status: "On Hold",
      },
      { new: true, runValidators: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/admin/:enquiryCode/reject", requireAdmin, async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      {
        adminApprovalStatus: "rejected",
        adminRemarks: text(req.body.adminRemarks || req.body.reason) || "Rejected by Admin",
        reviewedBy: text(req.body.reviewedBy) || "admin",
        reviewedAt: new Date(),
        contactReleased: false,
        contactRoute: "admin",
        status: "Rejected",
      },
      { new: true, runValidators: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Provider dashboard: enquiries matching assignedProviderUserCode, forwardedToUserCode, providerUserCode, OR originalProviderUserCode.
router.get("/provider/my", requireUserCode, async (req, res) => {
  try {
    const userCode = text(req.query.providerUserCode || req.userCode);
    const regex = new RegExp("^" + userCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "$", "i");
    const enquiries = await Enquiry.find({
      $or: [
        { assignedProviderUserCode: regex },
        { forwardedToUserCode: regex },
        { providerUserCode: regex },
        { originalProviderUserCode: regex }
      ]
    }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Buyer dashboard: buyer may view their own enquiry and current status.
router.get("/buyer/my", requireUserCode, async (req, res) => {
  try {
    const userCode = text(req.query.buyerUserCode || req.userCode);
    const regex = new RegExp("^" + userCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "$", "i");
    
    // Also match buyer phone if user model exists
    const user = await User.findOne({ userCode: regex }).lean();
    const userPhone = user ? normalisePhone(user.phone) : "";

    const filter = {
      $or: [
        { buyerUserCode: regex },
        ...(userPhone ? [{ buyerPhone: userPhone }] : [])
      ]
    };

    const enquiries = await Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/code/:enquiryCode", requireUserCode, async (req, res) => {
  try {
    let enquiry = await Enquiry.findOne({ enquiryCode: req.params.enquiryCode }).lean();
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    const isAdmin = String(req.headers["x-user-role"] || "").toLowerCase() === "admin";
    const isBuyer = enquiry.buyerUserCode && enquiry.buyerUserCode === req.userCode;
    const isAssignedProvider =
      (enquiry.providerUserCode && enquiry.providerUserCode === req.userCode) ||
      (enquiry.contactReleased && enquiry.assignedProviderUserCode === req.userCode);

    if (!isAdmin && !isBuyer && !isAssignedProvider) {
      return res.status(403).json({ success: false, message: "Enquiry access not permitted" });
    }

    if (enquiry.enquiryCategory === "realestate" && enquiry.propertyCode) {
      enquiry.property = await RealEstateProperty.findOne({ propertyCode: enquiry.propertyCode }).lean();
    } else if (enquiry.providerUserCode && enquiry.itemName) {
      const listing = await MarketplaceListing.findOne({
        providerUserCode: enquiry.providerUserCode,
        itemName: enquiry.itemName,
        status: "approved",
        isActive: true,
        isBlocked: false,
      }).lean();
      if (listing) {
        enquiry.uploadedRate = listing.rate;
        enquiry.uploadedUnit = listing.unit;
        enquiry.gst = listing.gst;
        enquiry.listingCode = listing.listingCode;
        enquiry.masterItemCode = listing.masterItemCode;
      }
    }

    if (!isAdmin && !isAssignedProvider) enquiry = hideBuyerContact(enquiry);
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Central list endpoint for both buyer and provider query calls.
router.get("/", requireUserCode, async (req, res) => {
  try {
    const isAdmin = String(req.headers["x-user-role"] || "").toLowerCase() === "admin";
    const reqCode = text(req.query.providerUserCode || req.query.buyerUserCode || req.userCode);
    const regex = new RegExp("^" + reqCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "$", "i");
    const filter = {};

    if (isAdmin) {
      if (req.query.providerUserCode) filter.providerUserCode = req.query.providerUserCode;
      if (req.query.buyerUserCode) filter.buyerUserCode = req.query.buyerUserCode;
      if (req.query.enquiryCategory) filter.enquiryCategory = req.query.enquiryCategory;
      if (req.query.propertyCode) filter.propertyCode = req.query.propertyCode;
    } else if (req.query.buyerUserCode) {
      filter.$or = [
        { buyerUserCode: regex }
      ];
    } else if (req.query.providerUserCode) {
      filter.$or = [
        { providerUserCode: regex },
        { assignedProviderUserCode: regex }
      ];
    } else {
      filter.$or = [
        { buyerUserCode: regex },
        { providerUserCode: regex },
        { assignedProviderUserCode: regex }
      ];
    }

    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/code/:enquiryCode/reject", requireUserCode, async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndUpdate(
      {
        enquiryCode: req.params.enquiryCode,
        assignedProviderUserCode: req.userCode,
        contactReleased: true,
      },
      { status: "Rejected", quoteMessage: text(req.body.reason) || "Rejected by assigned provider" },
      { new: true, runValidators: true }
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Released enquiry not found" });
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id/quote", requireUserCode, async (req, res) => {
  try {
    if (req.body.quotedAmount === undefined || req.body.quotedAmount === null || req.body.quotedAmount === "") {
      return res.status(400).json({ success: false, message: "quotedAmount is required" });
    }

    const enquiry = await Enquiry.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedProviderUserCode: req.userCode,
        contactReleased: true,
        adminApprovalStatus: { $in: ["approved", "assigned"] },
      },
      {
        status: "Quoted",
        quotedAmount: Number(req.body.quotedAmount),
        quoteMessage: text(req.body.quoteMessage),
        quoteValidityDate: text(req.body.quoteValidityDate),
        paymentTerms: text(req.body.paymentTerms),
        gstIncluded: Boolean(req.body.gstIncluded),
        transportCharges: Number(req.body.transportCharges) || 0,
        quotedDate: new Date().toISOString().split("T")[0],
      },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Admin-released enquiry not found" });
    }
    return res.json({ success: true, enquiry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});


/* =========================================================
   BUILDMITRA BATCH QUOTE 19-08-2026
   One supplier quote for all enquiries in same batchCode.
   ========================================================= */

router.put("/batch/:batchCode/quote", requireUserCode, async (req, res) => {
  try {
    const batchCode = text(req.params.batchCode);

    if (!batchCode) {
      return res.status(400).json({
        success: false,
        message: "batchCode is required"
      });
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one quote item is required"
      });
    }

    const enquiries = await Enquiry.find({
      batchCode,
      assignedProviderUserCode: req.userCode,
      contactReleased: true,
      adminApprovalStatus: { $in: ["approved", "assigned"] }
    });

    if (!enquiries.length) {
      return res.status(404).json({
        success: false,
        message: "Supplier batch enquiry not found"
      });
    }

    const updates = [];

    for (const enquiry of enquiries) {
      const quoteItem = items.find(
        (x) =>
          String(x.enquiryId || "") === String(enquiry._id) ||
          String(x.enquiryCode || "") === String(enquiry.enquiryCode)
      );

      if (!quoteItem) continue;

      const quantity =
        Number(quoteItem.quantity ?? enquiry.quantity ?? 0) || 0;

      const rate =
        Number(quoteItem.rate ?? quoteItem.quotedRate ?? 0) || 0;

      const lineAmount =
        Number(quoteItem.amount ?? quantity * rate) || 0;

      enquiry.status = "Quoted";
      enquiry.quotedAmount = lineAmount;
      enquiry.quoteMessage = text(
        quoteItem.remarks ||
        req.body.remarks ||
        "Supplier consolidated quotation"
      );
      enquiry.quoteValidityDate = text(
        req.body.quoteValidityDate ||
        req.body.deliveryTime
      );
      enquiry.paymentTerms = text(req.body.paymentTerms);
      enquiry.gstIncluded = Boolean(req.body.gstIncluded);
      enquiry.transportCharges =
        Number(req.body.transportCharges) || 0;
      enquiry.quotedDate =
        new Date().toISOString().split("T")[0];

      if (quoteItem.quantity !== undefined) {
        enquiry.quantity = quoteItem.quantity;
      }

      if (quoteItem.unit !== undefined) {
        enquiry.unit = text(quoteItem.unit);
      }

      if (quoteItem.availability !== undefined) {
        enquiry.availability = text(quoteItem.availability);
      }

      await enquiry.save();

      updates.push({
        enquiryId: enquiry._id,
        enquiryCode: enquiry.enquiryCode,
        itemName: enquiry.itemName,
        quantity,
        unit: enquiry.unit,
        rate,
        amount: lineAmount,
        status: enquiry.status
      });
    }

    if (!updates.length) {
      return res.status(400).json({
        success: false,
        message: "No matching batch items were updated"
      });
    }

    const subtotal = updates.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const gstAmount =
      Number(req.body.gstAmount) || 0;

    const transportCharges =
      Number(req.body.transportCharges) || 0;

    const loadingCharges =
      Number(req.body.loadingCharges) || 0;

    const unloadingCharges =
      Number(req.body.unloadingCharges) || 0;

    const discount =
      Number(req.body.discount) || 0;

    const grandTotal =
      subtotal +
      gstAmount +
      transportCharges +
      loadingCharges +
      unloadingCharges -
      discount;

    return res.json({
      success: true,
      message: "Consolidated supplier quote submitted",
      batchCode,
      count: updates.length,
      items: updates,
      subtotal,
      gstAmount,
      transportCharges,
      loadingCharges,
      unloadingCharges,
      discount,
      grandTotal
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


/* =========================================================
   BUILDMITRA_ONE_CLICK_QUOTE_20260819
   Supplier taps WhatsApp Reply Quote:
   saved rates -> official quote -> DB -> buyer WhatsApp
   ========================================================= */

router.post("/batch/:batchCode/quick-reply", async (req, res) => {
  try {
    const batchCode = text(req.params.batchCode);
    const providerUserCode = text(req.body.providerUserCode);
    const quickReplyCode = text(req.body.quickReplyCode);

    if (!batchCode || !providerUserCode || !quickReplyCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid quick reply link"
      });
    }

    const enquiries = await Enquiry.find({
      batchCode,
      providerUserCode,
      quickReplyCode
    }).sort({ createdAt: 1 });

    if (!enquiries.length) {
      return res.status(404).json({
        success: false,
        message: "Quick quote enquiry not found or link expired"
      });
    }

    const supplier = await User.findOne({
      userCode: providerUserCode
    }).select("-password").lean();

    const supplierName =
      supplier?.companyName ||
      supplier?.businessName ||
      supplier?.name ||
      enquiries[0]?.providerName ||
      "BuildMitra Supplier";

    const supplierPhone =
      supplier?.phone ||
      supplier?.mobile ||
      supplier?.officePhone ||
      enquiries[0]?.providerPhone ||
      "";

    const supplierAddress =
      supplier?.businessAddress ||
      supplier?.officeAddress ||
      supplier?.address ||
      supplier?.location ||
      "";

    const STANDARD_TERMS = [
      "Rates are subject to stock availability.",
      "Material quantity and quality to be verified at delivery.",
      "GST, transport, loading and unloading are as specifically stated in the quotation.",
      "Payment terms: as mutually agreed / before dispatch unless otherwise agreed.",
      "Quotation validity: 15 days from quotation date."
    ];

    const quoteItems = [];

    for (const enquiry of enquiries) {
      let listing = null;

      if (enquiry.masterItemCode) {
        listing = await MarketplaceListing.findOne({
          providerUserCode,
          masterItemCode: enquiry.masterItemCode,
          status: "approved",
          isActive: true,
          isBlocked: false
        }).lean();
      }

      if (!listing && enquiry.itemName) {
        listing = await MarketplaceListing.findOne({
          providerUserCode,
          itemName: enquiry.itemName,
          status: "approved",
          isActive: true,
          isBlocked: false
        }).lean();
      }

      const quantity = Number(enquiry.quantity || 0);
      const rate = Math.round(Number(listing?.rate || 0));
      const amount = Math.round(quantity * rate);
      const unit = String(enquiry.unit || listing?.unit || "").toUpperCase();

      quoteItems.push({
        enquiryId: enquiry._id,
        enquiryCode: enquiry.enquiryCode,
        itemName: enquiry.itemName,
        quantity,
        unit,
        rate,
        amount
      });
    }

    if (quoteItems.some(item => item.rate <= 0)) {
      return res.status(400).json({
        success: false,
        message: "One or more supplier rates are missing. Please update marketplace rates first."
      });
    }

    const subtotal = quoteItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const gstAmount = 0;
    const transportCharges = 0;
    const loadingCharges = 0;
    const unloadingCharges = 0;
    const discount = 0;

    const grandTotal =
      subtotal +
      gstAmount +
      transportCharges +
      loadingCharges +
      unloadingCharges -
      discount;

    const quoteDate = new Date()
      .toISOString()
      .split("T")[0];

    const quoteRef =
      `QTE-${Date.now().toString().slice(-8)}`;

    const quoteLines = quoteItems
      .map((item, index) => {
        const shortName = String(item.itemName || "")
          .trim()
          .split(/\s+/)
          .slice(0, 9)
          .join(" ");

        return `${index + 1}. ${shortName} - ${item.quantity} ${item.unit} - ₹${item.rate.toLocaleString("en-IN")}/- - Amt ₹${item.amount.toLocaleString("en-IN")}`;
      })
      .join("\n");

    const buyer = enquiries[0];

    const whatsappMessage =
`🏗️ BUILDMITRA OFFICIAL QUOTATION

Quote Ref: ${quoteRef}
Enquiry Ref: ${batchCode}
Date: ${quoteDate}

Supplier: ${supplierName}
Address: ${supplierAddress || "-"}
Phone: ${supplierPhone || "-"}

Buyer: ${buyer.buyerName}
Delivery: ${buyer.location || "-"} - ${buyer.pincode || ""}

${quoteLines}

Total Amount: ₹${grandTotal.toLocaleString("en-IN")}

Standard Terms:
1. ${STANDARD_TERMS[0]}
2. ${STANDARD_TERMS[1]}
3. ${STANDARD_TERMS[2]}
4. ${STANDARD_TERMS[3]}
5. ${STANDARD_TERMS[4]}

BuildMitra`;

    // Save one quote record for every linked enquiry item,
    // all sharing the same batchCode / quote reference.
    for (const item of quoteItems) {
      await Quote.create({
        quoteCode:
          `${quoteRef}-${String(item.enquiryCode || "").replace(/\W/g, "").slice(-6)}`,

        enquiryCode: item.enquiryCode,
        batchCode,

        buyerUserCode: buyer.buyerUserCode,
        buyerName: buyer.buyerName,
        buyerPhone: buyer.buyerPhone,

        providerUserCode,
        providerName: supplierName,
        providerPhone: supplierPhone,
        providerRole:
          supplier?.businessRole ||
          buyer.providerRole ||
          "supplier",

        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        subtotal: item.amount,

        gstAmount: 0,
        transportCharges: 0,
        loadingCharges: 0,
        unloadingCharges: 0,
        discount: 0,

        totalAmount: item.amount,
        grandTotal: item.amount,

        deliveryTime: "As per stock availability",
        terms: STANDARD_TERMS.join(" | "),
        remarks: `Automatic official quotation for batch ${batchCode}`,
        status: "sent",
        whatsappMessage
      });
    }

    // Update enquiry collection as quoted as well.
    for (const item of quoteItems) {
      await Enquiry.updateOne(
        { _id: item.enquiryId },
        {
          $set: {
            status: "Quoted",
            quoteStatus: "quoted",
            quotedAmount: item.amount,
            quoteMessage: whatsappMessage,
            quotedDate: quoteDate,
            paymentTerms:
              "As mutually agreed / before dispatch",
            gstIncluded: false,
            transportCharges: 0
          }
        }
      );
    }

    return res.json({
      success: true,
      quoteRef,
      batchCode,
      buyerPhone: buyer.buyerPhone,
      buyerName: buyer.buyerName,
      supplierName,
      supplierAddress,
      items: quoteItems,
      subtotal,
      grandTotal,
      whatsappMessage
    });

  } catch (error) {
    console.error("One-click quote error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;









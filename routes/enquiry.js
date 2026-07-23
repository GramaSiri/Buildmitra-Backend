const express = require("express");
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

    const enquiry = await Enquiry.create({
      ...req.body,
      ...provider,
      enquiryCode: await nextEnquiryCode(),
      buyerName,
      buyerPhone,
      buyerEmail: text(req.body.buyerEmail),
      adminPhone,
      contactRoute: "admin",
      adminApprovalStatus: "pending_admin",
      contactReleased: false,
      status: "Pending Admin",
      assignedProviderUserCode: "",
      assignedProviderName: "",
      assignedProviderPhone: "",
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

module.exports = router;


const express = require("express");
const router = express.Router();

const Enquiry = require("../models/Enquiry");
const MarketplaceListing = require("../models/MarketplaceListing");
const RealEstateProperty = require("../models/RealEstateProperty");
const User = require("../models/User");

function normalisePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function configuredAdminPhone() {
  const phone = normalisePhone(process.env.ADMIN_REAL_ESTATE_PHONE);

  if (phone.length < 10 || phone.length > 15) {
    return "";
  }

  return phone;
}

function requireAdmin(req, res, next) {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin required",
    });
  }

  next();
}

async function nextEnquiryCode() {
  const last = await Enquiry.findOne({
    enquiryCode: /^ENQ-\d{6}$/,
  })
    .sort({ enquiryCode: -1 })
    .select("enquiryCode")
    .lean();

  const lastNumber = last
    ? Number(String(last.enquiryCode).replace("ENQ-", ""))
    : 0;

  return `ENQ-${String(lastNumber + 1).padStart(6, "0")}`;
}

router.post("/", async (req, res) => {
  try {
    const buyerName = String(req.body.buyerName || "").trim();
    const buyerPhone = String(req.body.buyerPhone || "").trim();

    if (!buyerName) {
      return res.status(400).json({
        success: false,
        message: "buyerName is required",
      });
    }

    if (!buyerPhone) {
      return res.status(400).json({
        success: false,
        message: "buyerPhone is required",
      });
    }

    const isRealEstate =
      String(req.body.enquiryCategory || "").toLowerCase() === "realestate" ||
      String(req.body.itemType || "").toLowerCase() === "realestate" ||
      Boolean(req.body.propertyCode);

    let enquiryPayload = {
      ...req.body,
      enquiryCode: await nextEnquiryCode(),
      buyerName,
      buyerPhone,
    };

    if (isRealEstate) {
      const propertyCode = String(req.body.propertyCode || "").trim();

      if (!propertyCode) {
        return res.status(400).json({
          success: false,
          message: "propertyCode is required for Real Estate enquiry",
        });
      }

      const property = await RealEstateProperty.findOne({
        propertyCode,
        status: "approved",
        isActive: true,
        isBlocked: false,
      }).lean();

      if (!property) {
        return res.status(404).json({
          success: false,
          message: "Approved property not found",
        });
      }

      const adminPhone = configuredAdminPhone();

      if (!adminPhone) {
        return res.status(500).json({
          success: false,
          message:
            "ADMIN_REAL_ESTATE_PHONE is missing or invalid. Configure a valid 10 to 15 digit Admin number.",
        });
      }

      enquiryPayload = {
        ...enquiryPayload,
        enquiryCategory: "realestate",
        propertyCode: property.propertyCode,

        itemType: "realestate",
        itemName: property.title,

        providerUserCode: property.providerUserCode,
        providerRole: property.providerRole,
        providerName: property.providerName,
        providerPhone: property.providerPhone,

        location:
          req.body.location ||
          [property.area, property.city].filter(Boolean).join(", "),
        pincode: req.body.pincode || property.pincode,

        adminPhone,
        contactRoute: "admin",
        status: "Pending",
      };
    } else {
      const providerUserCode = String(
        req.body.providerUserCode || ""
      ).trim();

      if (!providerUserCode) {
        return res.status(400).json({
          success: false,
          message: "providerUserCode is required",
        });
      }

      enquiryPayload.providerUserCode = providerUserCode;
      enquiryPayload.enquiryCategory =
        req.body.enquiryCategory || "marketplace";
      enquiryPayload.contactRoute = "provider";
    }

    const enquiry = await Enquiry.create(enquiryPayload);

    if (isRealEstate) {
      await RealEstateProperty.updateOne(
        { propertyCode: enquiry.propertyCode },
        { $inc: { enquiryCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      enquiry,

      contactPhone:
        enquiry.contactRoute === "admin"
          ? enquiry.adminPhone
          : enquiry.providerPhone,

      providerContact: {
        userCode: enquiry.providerUserCode,
        name: enquiry.providerName,
        phone: enquiry.providerPhone,
      },

      routingMessage:
        enquiry.contactRoute === "admin"
          ? "Real Estate enquiry routed to Admin. Property uploader details remain visible to Admin."
          : "Enquiry routed to provider.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/code/:enquiryCode", async (req, res) => {
  try {
    let enquiry = await Enquiry.findOne({
      enquiryCode: req.params.enquiryCode,
    }).lean();

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    if (enquiry.enquiryCategory === "realestate" && enquiry.propertyCode) {
      const property = await RealEstateProperty.findOne({
        propertyCode: enquiry.propertyCode,
      }).lean();

      if (property) {
        enquiry.property = property;
      }
    } else {
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

    res.json({ success: true, enquiry });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.providerUserCode) {
      filter.providerUserCode = req.query.providerUserCode;
    }

    if (req.query.buyerUserCode) {
      filter.buyerUserCode = req.query.buyerUserCode;
    }

    if (req.query.enquiryCategory) {
      filter.enquiryCategory = req.query.enquiryCategory;
    }

    if (req.query.propertyCode) {
      filter.propertyCode = req.query.propertyCode;
    }

    const enquiries = await Enquiry.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      enquiries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/admin/realestate", requireAdmin, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({
      enquiryCategory: "realestate",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: enquiries.length,
      enquiries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put(
  "/admin/:enquiryCode/forward",
  requireAdmin,
  async (req, res) => {
    try {
      const targetUserCode = String(
        req.body.targetUserCode || ""
      ).trim();

      if (!targetUserCode) {
        return res.status(400).json({
          success: false,
          message: "targetUserCode is required",
        });
      }

      const targetUser = await User.findOne({
        userCode: targetUserCode,
        businessRole: "realestate",
        isActive: { $ne: false },
      })
        .select("-password")
        .lean();

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "Active registered Real Estate user not found",
        });
      }

      const targetPhone = normalisePhone(targetUser.phone);

      if (targetPhone.length < 10 || targetPhone.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Selected user has no valid registered phone number",
        });
      }

      const enquiry = await Enquiry.findOneAndUpdate(
        {
          enquiryCode: req.params.enquiryCode,
          enquiryCategory: "realestate",
        },
        {
          contactRoute: "forwarded-user",
          forwardedToUserCode: targetUser.userCode,
          forwardedToName: targetUser.name,
          forwardedToPhone: targetPhone,
          forwardedBy: req.body.forwardedBy || "admin",
          forwardedAt: new Date(),
          status: "Forwarded",
        },
        { new: true }
      );

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Real Estate enquiry not found",
        });
      }

      res.json({
        success: true,
        enquiry,
        contactPhone: targetPhone,
        message: "Enquiry forwarded to registered Real Estate user",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.put("/code/:enquiryCode/reject", async (req, res) => {
  try {
    const enquiry = await Enquiry.findOneAndUpdate(
      { enquiryCode: req.params.enquiryCode },
      {
        status: "Rejected",
        quoteMessage: req.body.reason || "Rejected by provider",
      },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    res.json({ success: true, enquiry });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/:id/quote", async (req, res) => {
  try {
    if (
      req.body.quotedAmount === undefined ||
      req.body.quotedAmount === null ||
      req.body.quotedAmount === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "quotedAmount is required",
      });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
  req.params.id,
  {
    status: "Quoted",
    quotedAmount: Number(req.body.quotedAmount),
    quoteMessage: req.body.quoteMessage || "",
    quoteValidityDate: req.body.quoteValidityDate || "",
    paymentTerms: req.body.paymentTerms || "",
    gstIncluded: Boolean(req.body.gstIncluded),
    transportCharges: Number(req.body.transportCharges) || 0,
    quotedDate: new Date().toISOString().split("T")[0],
  },
  { new: true }
);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    res.json({ success: true, enquiry });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

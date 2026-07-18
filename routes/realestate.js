const express = require("express");
const router = express.Router();

const RealEstateProperty = require("../models/RealEstateProperty");
const User = require("../models/User");

function requireAdmin(req, res, next) {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin required",
    });
  }

  next();
}

async function nextPropertyCode() {
  const last = await RealEstateProperty.findOne({
    propertyCode: /^REP-\d{6}$/,
  })
    .sort({ propertyCode: -1 })
    .select("propertyCode")
    .lean();

  const lastNumber = last
    ? Number(String(last.propertyCode).replace("REP-", ""))
    : 0;

  return `REP-${String(lastNumber + 1).padStart(6, "0")}`;
}

router.post("/", async (req, res) => {
  try {
    const providerUserCode = String(
      req.body.providerUserCode || ""
    ).trim();

    if (!providerUserCode) {
      return res.status(400).json({
        success: false,
        message: "providerUserCode is required",
      });
    }

    const user = await User.findOne({ userCode: providerUserCode })
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Registered property uploader not found",
      });
    }

    if (user.businessRole !== "realestate" && user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only registered Real Estate users can upload properties",
      });
    }

    const registeredPhone = String(user.phone || "").trim();

    if (!registeredPhone) {
      return res.status(400).json({
        success: false,
        message: "Uploader has no registered phone number",
      });
    }

    const requiredFields = [
      "transactionType",
      "propertyType",
      "title",
      "city",
    ];

    for (const field of requiredFields) {
      if (!String(req.body[field] || "").trim()) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }
    }

    const property = await RealEstateProperty.create({
      ...req.body,
      propertyCode: await nextPropertyCode(),

      providerUserCode: user.userCode,
      providerRole: user.businessRole || "realestate",
      providerName: user.name,
      providerPhone: registeredPhone,
      providerEmail: user.email || "",

      status: "pending",
      isActive: true,
      isBlocked: false,
      submittedBy: user.userCode,
      approvedBy: "",
      approvedAt: undefined,
      rejectedReason: "",
    });

    res.status(201).json({
      success: true,
      message: "Property submitted for Admin approval",
      property,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/public", async (req, res) => {
  try {
    const filter = {
      status: "approved",
      isActive: true,
      isBlocked: false,
    };

    if (req.query.transactionType) {
      filter.transactionType = req.query.transactionType;
    }

    if (req.query.propertyType) {
      filter.propertyType = req.query.propertyType;
    }

    if (req.query.city) {
      filter.city = new RegExp(req.query.city, "i");
    }

    if (req.query.pincode) {
      filter.pincode = String(req.query.pincode);
    }

    if (req.query.search) {
      const search = new RegExp(req.query.search, "i");

      filter.$or = [
        { title: search },
        { description: search },
        { city: search },
        { area: search },
        { landmark: search },
        { providerName: search },
      ];
    }

    const properties = await RealEstateProperty.find(filter)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(300);

    res.json({
      success: true,
      count: properties.length,
      properties,
      listings: properties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/mine/:providerUserCode", async (req, res) => {
  try {
    const properties = await RealEstateProperty.find({
      providerUserCode: req.params.providerUserCode,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/code/:propertyCode", async (req, res) => {
  try {
    const property = await RealEstateProperty.findOne({
      propertyCode: req.params.propertyCode,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/code/:propertyCode", async (req, res) => {
  try {
    const providerUserCode = String(
      req.body.providerUserCode || ""
    ).trim();

    const property = await RealEstateProperty.findOne({
      propertyCode: req.params.propertyCode,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (
      property.providerUserCode !== providerUserCode &&
      req.headers["x-user-role"] !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit another user's property",
      });
    }

    const protectedFields = [
      "_id",
      "propertyCode",
      "providerUserCode",
      "providerRole",
      "providerName",
      "providerPhone",
      "providerEmail",
      "approvedBy",
      "approvedAt",
      "createdAt",
      "updatedAt",
    ];

    const update = { ...req.body };

    protectedFields.forEach((field) => delete update[field]);

    if (req.headers["x-user-role"] !== "admin") {
      delete update.status;
      delete update.isBlocked;
      delete update.isFeatured;

      update.status = "pending";
      update.approvedBy = "";
      update.approvedAt = null;
    }

    const updated = await RealEstateProperty.findOneAndUpdate(
      { propertyCode: req.params.propertyCode },
      update,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message:
        req.headers["x-user-role"] === "admin"
          ? "Property updated"
          : "Property updated and returned for Admin approval",
      property: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/code/:propertyCode/availability", async (req, res) => {
  try {
    const allowedStatus = ["sold", "rented", "inactive"];

    if (!allowedStatus.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be sold, rented or inactive",
      });
    }

    const property = await RealEstateProperty.findOneAndUpdate(
      {
        propertyCode: req.params.propertyCode,
        providerUserCode: req.body.providerUserCode,
      },
      {
        status: req.body.status,
        isActive: false,
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or ownership mismatch",
      });
    }

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const filter = {};

    if (req.query.status && req.query.status !== "all") {
      filter.status = req.query.status;
    }

    const properties = await RealEstateProperty.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/admin/:propertyCode/approve", requireAdmin, async (req, res) => {
  try {
    const property = await RealEstateProperty.findOneAndUpdate(
      { propertyCode: req.params.propertyCode },
      {
        status: "approved",
        isActive: true,
        isBlocked: false,
        approvedBy: req.body.approvedBy || "admin",
        approvedAt: new Date(),
        rejectedReason: "",
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/admin/:propertyCode/reject", requireAdmin, async (req, res) => {
  try {
    const property = await RealEstateProperty.findOneAndUpdate(
      { propertyCode: req.params.propertyCode },
      {
        status: "rejected",
        isActive: false,
        rejectedReason:
          req.body.rejectedReason ||
          req.body.reason ||
          "Rejected by Admin",
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({ success: true, property });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/admin/:propertyCode/block", requireAdmin, async (req, res) => {
  try {
    const property = await RealEstateProperty.findOneAndUpdate(
      { propertyCode: req.params.propertyCode },
      {
        isBlocked: true,
        isActive: false,
      },
      { new: true }
    );

    res.json({
      success: Boolean(property),
      property,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/admin/:propertyCode/feature", requireAdmin, async (req, res) => {
  try {
    const property = await RealEstateProperty.findOneAndUpdate(
      { propertyCode: req.params.propertyCode },
      {
        isFeatured: Boolean(req.body.isFeatured),
      },
      { new: true }
    );

    res.json({
      success: Boolean(property),
      property,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

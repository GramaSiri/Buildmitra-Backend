const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

const ALLOWED_BUSINESS_ROLES = [
  "buyer",
  "contractor",
  "supplier",
  "vendor",
  "laboursupply",
  "machinehire",
  "realestate",
  "admin"
];

function normalizePhone(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email || "",
    phone: user.phone,
    role: user.role,
    businessRole: user.businessRole || "buyer",
    userCode: user.userCode,
    companyName: user.companyName || "",
    gstNo: user.gstNo || "",
    officePhone: user.officePhone || "",
    address: user.address || "",
    city: user.city || "",
    state: user.state || "",
    pincode: user.pincode || "",
    isActive: user.isActive,
    isMarketplaceVisible: user.isMarketplaceVisible,
    isVerified: user.isVerified,
    blockedReason: user.blockedReason || "",
    assignedProjects: user.assignedProjects || []
  };
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      userCode: user.userCode,
      businessRole: user.businessRole,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Register
router.post("/register", async (req, res) => {
  try {
    const normalizedName = String(req.body.name || "").trim();
    const normalizedEmail = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const normalizedPhone = normalizePhone(req.body.phone);

    const normalizedBusinessRole = normalizeRole(
      req.body.businessRole ||
        req.body.userType ||
        req.body.role ||
        "buyer"
    );

    const password = String(req.body.password || "");
    const normalizedPincode = String(req.body.pincode || "")
      .replace(/\D/g, "")
      .slice(-6);

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit mobile number"
      });
    }

    if (normalizedPincode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit PIN code"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    if (!ALLOWED_BUSINESS_ROLES.includes(normalizedBusinessRole)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid user role"
      });
    }

    if (normalizedBusinessRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be created from public registration"
      });
    }

    const existingPhoneUser = await User.findOne({
      phone: normalizedPhone
    });

    if (existingPhoneUser) {
      return res.status(400).json({
        success: false,
        message:
          "This mobile number is already registered. Please log in or reset your password."
      });
    }

    if (normalizedEmail) {
      const existingEmailUser = await User.findOne({
        email: normalizedEmail
      });

      if (existingEmailUser) {
        return res.status(400).json({
          success: false,
          message: "This email address is already registered"
        });
      }
    }

    const user = new User({
      name: normalizedName,
      email: normalizedEmail || undefined,
      phone: normalizedPhone,
      password,
      businessRole: normalizedBusinessRole,
      role: "user",
      companyName: String(req.body.companyName || "").trim(),
      gstNo: String(req.body.gstNo || "").trim(),
      officePhone: normalizePhone(req.body.officePhone),
      address: String(req.body.address || "").trim(),
      city: String(req.body.city || "").trim(),
      state: String(req.body.state || "").trim(),
      pincode: normalizedPincode,

      subscriptionPlan: ["basic", "professional", "business"].includes(
        String(req.body.subscriptionPlan || req.body.planId || req.body.plan || "basic").toLowerCase()
      )
        ? String(req.body.subscriptionPlan || req.body.planId || req.body.plan || "basic").toLowerCase()
        : "basic",

      subscriptionBilling: ["monthly", "annual"].includes(
        String(req.body.subscriptionBilling || req.body.billing || "monthly").toLowerCase()
      )
        ? String(req.body.subscriptionBilling || req.body.billing || "monthly").toLowerCase()
        : "monthly",

      isActive: true,
      activationType: "beta_free",
      subscriptionStatus: "active",
      paymentStatus: "not_required",
      subscriptionStart: new Date(),
      subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      adminRemarks: "Free beta access activated automatically"
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error && error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      return res.status(400).json({
        success: false,
        message:
          duplicateField === "phone"
            ? "This mobile number is already registered"
            : duplicateField === "email"
              ? "This email address is already registered"
              : "This account already exists"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const loginId = String(
      req.body.email ||
        req.body.phone ||
        req.body.phoneOrEmail ||
        ""
    ).trim();

    const password = String(req.body.password || "");

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile/email and password are required"
      });
    }

    const normalizedLoginEmail = loginId.toLowerCase();
    const normalizedLoginPhone = normalizePhone(loginId);

    const conditions = [{ email: normalizedLoginEmail }];

    if (normalizedLoginPhone.length === 10) {
      conditions.push({ phone: normalizedLoginPhone });
    }

    const user = await User.findOne({
      $or: conditions
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid mobile/email or password"
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid mobile/email or password"
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: user.blockedReason || "This account has been blocked"
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      token: createToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
});

// Check registered phone and role
router.post("/forgot-password/check-phone", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const requestedRole = normalizeRole(req.body.businessRole);

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid registered mobile number"
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number"
      });
    }

    if (
      requestedRole &&
      normalizeRole(user.businessRole) !== requestedRole
    ) {
      return res.status(400).json({
        success: false,
        message: `This mobile number is registered as ${user.businessRole}`
      });
    }

    return res.json({
      success: true,
      message: "Mobile number verified",
      businessRole: user.businessRole,

      // Temporary beta OTP only.
      betaOtp: "123456"
    });
  } catch (error) {
    console.error("Forgot-password check error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify mobile number"
    });
  }
});

// Reset password - temporary beta OTP flow
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const requestedRole = normalizeRole(req.body.businessRole);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid registered mobile number"
      });
    }

    if (otp !== "123456") {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number"
      });
    }

    if (
      requestedRole &&
      normalizeRole(user.businessRole) !== requestedRole
    ) {
      return res.status(400).json({
        success: false,
        message: `This mobile number is registered as ${user.businessRole}`
      });
    }

    user.password = newPassword;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful"
    });
  } catch (error) {
    console.error("Password reset error:", error);

    return res.status(500).json({
      success: false,
      message: "Password reset failed. Please try again."
    });
  }
});

module.exports = router;

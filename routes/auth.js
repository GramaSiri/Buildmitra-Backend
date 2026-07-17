const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    businessRole: user.businessRole,
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

// Register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      businessRole,
      companyName,
      gstNo,
      officePhone,
      address,
      city,
      state,
      pincode
    } = req.body;

    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { phone: phone }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    const user = new User({
      name,
      email,
      phone,
      password,
      businessRole: businessRole || 'buyer',
      companyName: companyName || "",
      gstNo: gstNo || "",
      officePhone: officePhone || "",
      address: address || "",
      city: city || "",
      state: state || "",
      pincode: pincode || ""
    });

    await user.save();

    const token = jwt.sign(
      {
        userId: user._id,
        userCode: user.userCode,
        businessRole: user.businessRole
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: safeUser(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, phone, phoneOrEmail, password } = req.body;
    const loginId = String(email || phone || phoneOrEmail || "").trim();

    const user = await User.findOne({
      $or: [
        { email: loginId },
        { phone: loginId }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        userCode: user.userCode,
        businessRole: user.businessRole
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: safeUser(user)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Check whether a registered phone exists
router.post('/forgot-password/check-phone', async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();

    if (!phone || phone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid registered mobile number'
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this mobile number'
      });
    }

    res.json({
      success: true,
      message: 'Mobile number verified',
      betaOtp: '123456'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Reset password - temporary beta OTP flow
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!phone || phone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid registered mobile number'
      });
    }

    if (otp !== '123456') {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this mobile number'
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

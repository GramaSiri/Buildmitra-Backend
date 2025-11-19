import Otp from '../models/Otp.js';
import Vendor from '../models/Vendor.js';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { syncToCRM } from '../utils/crmSync.js';

export const requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

    await Otp.deleteMany({ phone });
    await Otp.create({ phone, otp });
    await sendOtp(phone, otp);

    console.log(`✅ OTP ${otp} sent to ${phone}`);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('❌ Error in requestOtp:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    console.log(`🔍 Verifying OTP ${otp} for ${phone}`);
    const record = await Otp.findOne({ phone, otp });
    console.log(`📂 DB Record:`, record);

    if (!record) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    await Otp.deleteMany({ phone });
    await syncToCRM({ phone });

    const vendor = await Vendor.findOne({ contactNumber: phone });

    const tokenPayload = {
      phone,
      vendorName: vendor?.vendorName || null,
      tradeType: vendor?.tradeType || null,
      materials: vendor?.materials || null,
      ratePerUnit: vendor?.ratePerUnit || null,
      servicePincodes: vendor?.servicePincodes || null,
      imageUrl: vendor?.imageUrl || null,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    const onboardingRequired = !vendor;

    res.json({
      token,
      message: 'Login successful',
      vendor: tokenPayload,
      onboardingRequired,
    });
  } catch (err) {
    console.error('❌ Error in verifyOtp:', err.message);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};
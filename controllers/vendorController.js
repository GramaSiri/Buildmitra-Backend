// controllers/vendorController.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Vendor from '../models/Vendor.js'; // ✅ Correct default import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vendorPath = path.join(__dirname, '../models/Vendor.js');
console.log('🔍 Checking Vendor.js at:', vendorPath);
console.log('📂 Exists:', fs.existsSync(vendorPath));

export const createVendor = async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVendors = async (req, res) => {
  try {
    const { pin, trade } = req.query;
    const vendors = await Vendor.find({
      servicePincodes: { $regex: pin },
      tradeType: { $regex: trade, $options: 'i' },
    });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Exit endpoint for health check or shutdown trigger
export const onboardVendor = async (req, res) => {
  res.status(200).json({ message: 'Vendor onboarded successfully.' });
};
import express from 'express';
import { createVendor, getVendors, exitVendorFlow } from '../controllers/vendorController.js';

const router = express.Router();

router.post('/', createVendor);
router.get('/', getVendors);

// ✅ Add this at the bottom
router.get('/exit', exitVendorFlow);

export default router;
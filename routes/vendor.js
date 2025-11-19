import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { onboardVendor } from '../controllers/vendorController.js';
import { exportBOQ } from '../controllers/exportController.js';

const router = express.Router();

router.post('/onboard', onboardVendor);
router.get('/secure-data', verifyToken, (req, res) => {
  res.json({ message: `Welcome ${req.user.phone}, this is protected data.` });
});
router.get('/export-boq', verifyToken, exportBOQ);

export default router;
import express from 'express';
import { requestOtp, verifyOtp } from '../controllers/authController.js';

const router = express.Router();

router.post('/auth/request-otp', requestOtp);
router.post('/auth/verify-otp', verifyOtp);

export default router;
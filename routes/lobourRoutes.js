import express from 'express';
import {
  createLabour,
  getLabour,
  exitLabourFlow
} from '../controllers/labourController.js';

const router = express.Router();

router.post('/', createLabour);
router.get('/', getLabour);
router.get('/exit', exitLabourFlow);

export default router;
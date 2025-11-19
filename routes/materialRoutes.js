import express from 'express';
import {
  createMaterial,
  getMaterials,
  exitMaterialFlow
} from '../controllers/materialController.js';

const router = express.Router();

router.post('/', createMaterial);
router.get('/', getMaterials);
router.get('/exit', exitMaterialFlow);

export default router;
import express from 'express';
import {
  createProject,
  getProjects,
  exitProjectFlow,
  updateBoqItem
} from '../controllers/projectController.js';

const router = express.Router();

router.post('/projects', createProject);
router.get('/projects', getProjects);
router.get('/projects/exit', exitProjectFlow);
router.patch('/projects/:projectId/boq/:boqIndex', updateBoqItem);

export default router;
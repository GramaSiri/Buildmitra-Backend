import express from 'express';
const router = express.Router();

// Sample POST endpoint
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Labour added successfully' });
});

// Sample GET endpoint
router.get('/', (req, res) => {
  res.status(200).json([{ name: 'Sample Labour', skill: 'Bar Bending' }]);
});

export default router;
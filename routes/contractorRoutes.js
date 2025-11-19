import express from 'express';
const router = express.Router();

// Sample POST endpoint
router.post('/', (req, res) => {
  res.status(201).json({ message: 'Contractor added successfully' });
});

// Sample GET endpoint
router.get('/', (req, res) => {
  res.status(200).json([{ name: 'Sample Contractor', trade: 'Masonry' }]);
});

export default router;
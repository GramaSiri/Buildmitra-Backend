import Labour from '../models/Labour.js';

export const createLabour = async (req, res) => {
  try {
    const labour = new Labour(req.body);
    await labour.save();
    res.status(201).json(labour);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create labour', details: err.message });
  }
};

export const getLabour = async (req, res) => {
  try {
    const { pin, skill } = req.query;
    const labourList = await Labour.find({
      servicePincodes: { $regex: pin },
      skillType: { $regex: new RegExp(skill, 'i') }
    });
    res.json(labourList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch labour', details: err.message });
  }
};

export const exitLabourFlow = (req, res) => {
  res.json({ message: 'Labour flow exited successfully' });
};
import Material from '../models/Material.js';

export const createMaterial = async (req, res) => {
  try {
    const material = new Material(req.body);
    await material.save();
    res.status(201).json(material);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create material', details: err.message });
  }
};

export const getMaterials = async (req, res) => {
  try {
    const { category, pin } = req.query;
    const materials = await Material.find({
      category: { $regex: new RegExp(category, 'i') },
      servicePincodes: { $regex: pin }
    });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch materials', details: err.message });
  }
};

export const exitMaterialFlow = (req, res) => {
  res.json({ message: 'Material flow exited successfully' });
};
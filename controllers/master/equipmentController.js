const service = require("../../services/master/equipmentService");

exports.getAll = async (req, res) => {
  try { res.json(await service.getAllEquipment()); }
  catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.create = async (req, res) => {
  try {
    await service.addEquipment(req.body);
    res.json({ success:true, message:"Equipment added successfully" });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

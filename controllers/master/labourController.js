const service = require("../../services/master/labourService");

exports.getAll = async (req, res) => {
  try { res.json(await service.getAllLabour()); }
  catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.create = async (req, res) => {
  try {
    await service.addLabour(req.body);
    res.json({ success:true, message:"Labour added successfully" });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

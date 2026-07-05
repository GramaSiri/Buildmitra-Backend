const service = require("../../services/master/serviceService");

exports.getAll = async (req, res) => {
  try { res.json(await service.getAllServices()); }
  catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.create = async (req, res) => {
  try {
    await service.addService(req.body);
    res.json({ success:true, message:"Service added successfully" });
  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
};

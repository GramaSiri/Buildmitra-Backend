const express = require("express");
const router = express.Router();
const controller = require("../../controllers/master/materialController");

const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

router.get("/", controller.getAll);
router.post("/", requireAdmin, controller.create);
router.post("/bulk", requireAdmin, controller.bulkCreate);
router.put("/:id", requireAdmin, controller.update);
router.delete("/:id", requireAdmin, controller.remove);

module.exports = router;
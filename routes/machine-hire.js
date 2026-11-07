const express = require("express");
const router = express.Router();
const {
  MachineListing,
  MachineRental,
  MachineMaintenance,
  MachineInvoice
} = require("../models/MachineHire");

function escapeRegex(str) {
  return String(str || "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getUserCode(req) {
  return String(
    req.headers["x-user-code"] ||
    req.query.userCode ||
    req.query.providerUserCode ||
    req.body.userCode ||
    ""
  ).trim();
}

const DEFAULT_MACHINES = [
  { name: "JCB 3DX", category: "Earth Moving", model: "2023", dailyRate: 4500, weeklyRate: 28000, monthlyRate: 95000, status: "Available", operatorRequired: true, operatorCost: 800, fuelType: "Diesel", images: [], documents: [] },
  { name: "Excavator Mini", category: "Earth Moving", model: "2022", dailyRate: 6500, weeklyRate: 40000, monthlyRate: 140000, status: "Rented", operatorRequired: true, operatorCost: 800, fuelType: "Diesel", images: [], documents: [] },
  { name: "Concrete Mixer 10/7", category: "Concrete", model: "2023", dailyRate: 2500, weeklyRate: 15000, monthlyRate: 50000, status: "Available", operatorRequired: false, operatorCost: 0, fuelType: "Diesel", images: [], documents: [] },
  { name: "Floor Polishing Machine", category: "Polishing", model: "2023", dailyRate: 1200, weeklyRate: 7000, monthlyRate: 25000, status: "Available", operatorRequired: false, operatorCost: 0, fuelType: "Electric", images: [], documents: [] },
  { name: "Tile Cutter Electric", category: "Cutting", model: "2024", dailyRate: 800, weeklyRate: 4500, monthlyRate: 15000, status: "Maintenance", operatorRequired: false, operatorCost: 0, fuelType: "Electric", images: [], documents: [] }
];

const DEFAULT_RENTALS = [
  { machineId: "default-2", machineName: "Excavator Mini", clientId: 1, clientName: "Rajesh Sharma", projectName: "Sunrise Villa", startDate: "2024-02-01", endDate: "2024-02-15", actualEndDate: null, dailyRate: 6200, operatorIncluded: true, totalDays: 14, totalAmount: 86800, securityDeposit: 20000, status: "Active" },
  { machineId: "default-5", machineName: "Tile Cutter Electric", clientId: 2, clientName: "Priya Mehta", projectName: "Green Heights", startDate: "2024-02-05", endDate: "2024-02-12", actualEndDate: null, dailyRate: 750, operatorIncluded: false, totalDays: 7, totalAmount: 5250, securityDeposit: 5000, status: "Active" }
];

// Get machines
router.get("/machines", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, machines: [] });

    const regex = new RegExp(`^${escapeRegex(userCode)}$`, "i");
    let machines = await MachineListing.find({ userCode: regex }).sort({ createdAt: -1 });

    if (machines.length === 0) {
      const toSeed = DEFAULT_MACHINES.map((m, idx) => ({
        ...m,
        userCode,
        machineCode: `MAC-${String(idx + 1).padStart(3, "0")}`
      }));
      machines = await MachineListing.insertMany(toSeed);
    }

    res.json({ success: true, count: machines.length, machines });
  } catch (error) {
    console.error("Get machines error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create machine
router.post("/machines", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const machineCount = await MachineListing.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });
    const machineCode = req.body.machineCode || `MAC-${String(machineCount + 1).padStart(3, "0")}`;

    const machine = new MachineListing({
      ...req.body,
      userCode,
      machineCode,
      dailyRate: Number(req.body.dailyRate) || 0,
      weeklyRate: Number(req.body.weeklyRate) || 0,
      monthlyRate: Number(req.body.monthlyRate) || 0,
      operatorCost: Number(req.body.operatorCost) || 0
    });

    await machine.save();
    res.status(201).json({ success: true, machine });
  } catch (error) {
    console.error("Create machine error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk import machines
router.post("/machines/bulk", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const items = Array.isArray(req.body) ? req.body : req.body.machines || [];
    const currentCount = await MachineListing.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });

    const docs = items.map((m, idx) => ({
      ...m,
      userCode,
      machineCode: m.machineCode || `MAC-${String(currentCount + idx + 1).padStart(3, "0")}`,
      name: m.name || m.Machine || "Machine",
      category: m.category || "Earth Moving",
      model: m.model || "2024",
      dailyRate: Number(m.dailyRate || 1000),
      weeklyRate: Number(m.weeklyRate || 6000),
      monthlyRate: Number(m.monthlyRate || 22000),
      status: m.status || "Available"
    }));

    const inserted = await MachineListing.insertMany(docs);
    res.json({ success: true, count: inserted.length, machines: inserted });
  } catch (error) {
    console.error("Bulk machines error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get rentals
router.get("/rentals", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, rentals: [] });

    let rentals = await MachineRental.find({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i")
    }).sort({ createdAt: -1 });

    if (rentals.length === 0) {
      const seeded = DEFAULT_RENTALS.map(r => ({ ...r, userCode }));
      rentals = await MachineRental.insertMany(seeded);
    }

    res.json({ success: true, count: rentals.length, rentals });
  } catch (error) {
    console.error("Get rentals error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create rental
router.post("/rentals", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const rental = new MachineRental({
      ...req.body,
      userCode,
      dailyRate: Number(req.body.dailyRate) || 0,
      totalDays: Number(req.body.totalDays) || 1,
      totalAmount: Number(req.body.totalAmount) || 0,
      securityDeposit: Number(req.body.securityDeposit) || 0
    });

    await rental.save();

    // Update machine status to Rented
    if (req.body.machineId) {
      await MachineListing.updateOne(
        { _id: req.body.machineId },
        { $set: { status: "Rented" } }
      ).catch(() => {});
    }

    res.status(201).json({ success: true, rental });
  } catch (error) {
    console.error("Create rental error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get maintenance
router.get("/maintenance", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, maintenance: [] });

    const maintenance = await MachineMaintenance.find({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i")
    }).sort({ createdAt: -1 });

    res.json({ success: true, count: maintenance.length, maintenance });
  } catch (error) {
    console.error("Get maintenance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create maintenance
router.post("/maintenance", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const item = new MachineMaintenance({
      ...req.body,
      userCode,
      cost: Number(req.body.cost) || 0
    });

    await item.save();

    // Update machine status to Maintenance
    if (req.body.machineId) {
      await MachineListing.updateOne(
        { _id: req.body.machineId },
        { $set: { status: "Maintenance" } }
      ).catch(() => {});
    }

    res.status(201).json({ success: true, maintenance: item });
  } catch (error) {
    console.error("Create maintenance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get invoices
router.get("/invoices", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, invoices: [] });

    const invoices = await MachineInvoice.find({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i")
    }).sort({ createdAt: -1 });

    res.json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create invoice
router.post("/invoices", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const invoice = new MachineInvoice({
      ...req.body,
      userCode,
      totalAmount: Number(req.body.totalAmount) || 0,
      dailyRate: Number(req.body.dailyRate) || 0,
      operatorCost: Number(req.body.operatorCost) || 0
    });

    await invoice.save();
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

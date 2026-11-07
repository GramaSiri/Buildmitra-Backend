const express = require("express");
const router = express.Router();
const {
  LabourWorker,
  LabourAttendance,
  LabourAssignment,
  LabourRateCard,
  LabourInvoice
} = require("../models/LabourSupply");

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

const DEFAULT_WORKERS = [
  { name: "Ramesh Kumar", skill: "Mason", dailyWage: 800, mobile: "+919876511111", experience: "5 years", rating: 4.5, status: "Deployed", projectId: 1 },
  { name: "Suresh Patel", skill: "Carpenter", dailyWage: 700, mobile: "+919876522222", experience: "4 years", rating: 4.2, status: "Deployed", projectId: 1 },
  { name: "Mahesh Singh", skill: "Helper", dailyWage: 500, mobile: "+919876533333", experience: "2 years", rating: 4.0, status: "Deployed", projectId: 1 },
  { name: "Amit Kumar", skill: "Electrician", dailyWage: 900, mobile: "+919876544444", experience: "6 years", rating: 4.8, status: "Deployed", projectId: 1 },
  { name: "Suresh Naik", skill: "Helper", dailyWage: 500, mobile: "", experience: "2 years", rating: 4.0, status: "Available", projectId: null },
  { name: "Prakash Shetty", skill: "Helper", dailyWage: 500, mobile: "", experience: "2 years", rating: 4.0, status: "Available", projectId: null }
];

const DEFAULT_RATES = [
  { skill: "Mason", baseRate: 800, overtimeRate: 120, notes: "Minimum 8 hours" },
  { skill: "Carpenter", baseRate: 700, overtimeRate: 105, notes: "Minimum 8 hours" },
  { skill: "Helper", baseRate: 500, overtimeRate: 75, notes: "Minimum 8 hours" },
  { skill: "Electrician", baseRate: 900, overtimeRate: 135, notes: "Certified only" }
];

// Get workers
router.get("/workers", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, workers: [] });

    const regex = new RegExp(`^${escapeRegex(userCode)}$`, "i");
    let workers = await LabourWorker.find({ userCode: regex }).sort({ createdAt: -1 });

    if (workers.length === 0) {
      // Seed initial verified workers tagged with this userCode
      const toSeed = DEFAULT_WORKERS.map((w, idx) => ({
        ...w,
        userCode,
        workerCode: `LAB-${String(idx + 1).padStart(3, "0")}`
      }));
      workers = await LabourWorker.insertMany(toSeed);
    }

    res.json({ success: true, count: workers.length, workers });
  } catch (error) {
    console.error("Get workers error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create worker
router.post("/workers", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const workerCount = await LabourWorker.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });
    const workerCode = req.body.workerCode || `LAB-${String(workerCount + 1).padStart(3, "0")}`;

    const worker = new LabourWorker({
      ...req.body,
      userCode,
      workerCode,
      dailyWage: Number(req.body.dailyWage) || 500
    });

    await worker.save();
    res.status(201).json({ success: true, worker });
  } catch (error) {
    console.error("Create worker error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk create workers
router.post("/workers/bulk", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const items = Array.isArray(req.body) ? req.body : req.body.workers || [];
    const currentCount = await LabourWorker.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });

    const docs = items.map((w, idx) => ({
      ...w,
      userCode,
      workerCode: w.workerCode || `LAB-${String(currentCount + idx + 1).padStart(3, "0")}`,
      dailyWage: Number(w.dailyWage || w.wage || 500),
      name: w.name || w.Worker || "Worker",
      skill: w.skill || w.category || "Helper",
      status: w.status || "Available"
    }));

    const inserted = await LabourWorker.insertMany(docs);
    res.json({ success: true, count: inserted.length, workers: inserted });
  } catch (error) {
    console.error("Bulk workers error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get attendance
router.get("/attendance", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, attendance: [] });

    const filter = { userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") };
    if (req.query.date) filter.date = req.query.date;

    const attendance = await LabourAttendance.find(filter).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, count: attendance.length, attendance });
  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record attendance
router.post("/attendance", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const { workerId, date, present, hours, overtime, wageAmount, projectId } = req.body;
    if (!workerId || !date) {
      return res.status(400).json({ success: false, message: "workerId and date are required" });
    }

    const log = await LabourAttendance.findOneAndUpdate(
      {
        userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
        workerId: String(workerId),
        date: String(date)
      },
      {
        $set: {
          ...req.body,
          userCode,
          workerId: String(workerId),
          date: String(date),
          present: Boolean(present),
          hours: Number(hours) || 8,
          overtime: Number(overtime) || 0,
          wageAmount: Number(wageAmount) || 0
        }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, attendance: log });
  } catch (error) {
    console.error("Record attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get assignments
router.get("/assignments", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, assignments: [] });

    const assignments = await LabourAssignment.find({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i")
    }).sort({ createdAt: -1 });

    res.json({ success: true, count: assignments.length, assignments });
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create assignment
router.post("/assignments", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const assignment = new LabourAssignment({
      ...req.body,
      userCode
    });

    await assignment.save();

    // Update worker status to Deployed
    if (req.body.workerId) {
      await LabourWorker.updateOne(
        { _id: req.body.workerId },
        { $set: { status: "Deployed", projectId: req.body.projectId, projectName: req.body.projectName } }
      ).catch(() => {});
    }

    res.status(201).json({ success: true, assignment });
  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get rate card
router.get("/rates", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, rates: [] });

    let rates = await LabourRateCard.find({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i")
    }).sort({ skill: 1 });

    if (rates.length === 0) {
      const seeded = DEFAULT_RATES.map(r => ({ ...r, userCode }));
      rates = await LabourRateCard.insertMany(seeded);
    }

    res.json({ success: true, count: rates.length, rates });
  } catch (error) {
    console.error("Get rates error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save rate card
router.post("/rates", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const rate = await LabourRateCard.findOneAndUpdate(
      {
        userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
        skill: req.body.skill
      },
      {
        $set: {
          ...req.body,
          userCode,
          baseRate: Number(req.body.baseRate) || 0,
          overtimeRate: Number(req.body.overtimeRate) || 0
        }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, rate });
  } catch (error) {
    console.error("Save rate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get invoices
router.get("/invoices", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, invoices: [] });

    const invoices = await LabourInvoice.find({
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

    const invoiceCount = await LabourInvoice.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });
    const invoiceId = req.body.invoiceId || `INV-LAB-${String(invoiceCount + 1).padStart(3, "0")}`;

    const invoice = new LabourInvoice({
      ...req.body,
      userCode,
      invoiceId,
      amount: Number(req.body.amount) || 0
    });

    await invoice.save();
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

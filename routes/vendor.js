const express = require("express");
const router = express.Router();
const VendorProject = require("../models/VendorProject");

function escapeRegex(str) {
  return String(str || "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getUserCode(req) {
  return String(
    req.headers["x-user-code"] ||
    req.query.userCode ||
    req.body.userCode ||
    ""
  ).trim();
}

const DEFAULT_VENDOR_PROJECTS = [
  {
    projectId: 1,
    name: "Sunrise Villa",
    client: "Rajesh Sharma",
    clientMobile: "+919876511111",
    location: "Andheri, Mumbai",
    bua: 2500,
    contractRate: 1800,
    totalAmount: 4500000,
    startDate: "2024-01-01",
    endDate: "2024-06-30",
    progress: 65,
    status: "In Progress",
    paymentReceived: 2925000,
    balancePayment: 1575000,
    milestones: [
      { id: 1, projectId: 1, name: "Site Clearance", plannedDate: "2024-01-10", actualDate: "2024-01-08", status: "Completed", claimAmount: 300000, paymentReceived: true },
      { id: 2, projectId: 1, name: "Foundation", plannedDate: "2024-01-25", actualDate: "2024-01-22", status: "Completed", claimAmount: 500000, paymentReceived: true },
      { id: 3, projectId: 1, name: "Ground Floor Slab", plannedDate: "2024-02-15", actualDate: null, status: "In Progress", claimAmount: 700000, paymentReceived: false }
    ],
    workers: [
      { id: 1, name: "Ramesh Kumar", role: "Mason", dailyWage: 800, mobile: "+919876511111", projectId: 1 },
      { id: 2, name: "Suresh Patel", role: "Carpenter", dailyWage: 700, mobile: "+919876522222", projectId: 1 }
    ],
    inventory: [
      { id: 1, projectId: 1, name: "Cement", required: 500, received: 450, consumed: 400, balance: 50, unit: "bags", supplier: "ABC Supplies" }
    ],
    claims: [
      { id: 1, projectId: 1, milestoneId: 3, milestoneName: "Ground Floor Slab", amount: 700000, date: "2024-02-01", status: "Pending" }
    ],
    changeOrders: [
      { id: 1, projectId: 1, description: "Additional bathroom flooring", quantity: 200, rate: 150, amount: 30000, status: "Approved", date: "2024-01-20" }
    ],
    siteMedia: [
      { id: 1, projectId: 1, type: "photo", title: "Foundation Work", date: "2024-01-25" }
    ],
    labourAttendance: []
  },
  {
    projectId: 2,
    name: "Green Heights",
    client: "Priya Mehta",
    clientMobile: "+919876522222",
    location: "Bandra, Mumbai",
    bua: 5000,
    contractRate: 1800,
    totalAmount: 9000000,
    startDate: "2024-02-01",
    endDate: "2024-08-31",
    progress: 40,
    status: "In Progress",
    paymentReceived: 3600000,
    balancePayment: 5400000,
    milestones: [],
    workers: [],
    inventory: [],
    claims: [],
    changeOrders: [],
    siteMedia: [],
    labourAttendance: []
  }
];

// Get vendor projects
router.get("/projects", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.json({ success: true, count: 0, projects: [] });

    const regex = new RegExp(`^${escapeRegex(userCode)}$`, "i");
    let projects = await VendorProject.find({ userCode: regex }).sort({ createdAt: -1 });

    if (projects.length === 0) {
      const toSeed = DEFAULT_VENDOR_PROJECTS.map(p => ({
        ...p,
        userCode
      }));
      projects = await VendorProject.insertMany(toSeed);
    }

    res.json({ success: true, count: projects.length, projects });
  } catch (error) {
    console.error("Get vendor projects error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create or update vendor project
router.post("/projects", async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const projectCount = await VendorProject.countDocuments({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });
    const pId = req.body.projectId || req.body.id || (projectCount + 1);

    const project = await VendorProject.findOneAndUpdate(
      {
        userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
        projectId: pId
      },
      {
        $set: {
          ...req.body,
          userCode,
          projectId: pId
        }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, project });
  } catch (error) {
    console.error("Save vendor project error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit payment claim
router.post(["/claim", "/projects/claim"], async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const { projectId, milestoneId, milestoneName, amount } = req.body;
    const project = await VendorProject.findOne({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
      projectId: projectId
    });

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const claimRecord = {
      id: (project.claims?.length || 0) + 1,
      projectId,
      milestoneId,
      milestoneName,
      amount: Number(amount) || 0,
      date: new Date().toISOString().split("T")[0],
      status: "Pending"
    };

    project.claims = [...(project.claims || []), claimRecord];
    await project.save();

    res.json({ success: true, claim: claimRecord, project });
  } catch (error) {
    console.error("Submit claim error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark worker attendance
router.post(["/attendance", "/projects/attendance"], async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const { projectId, workerId, date, present } = req.body;
    const project = await VendorProject.findOne({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
      projectId: projectId
    });

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const existingIndex = (project.labourAttendance || []).findIndex(
      a => a.workerId == workerId && a.date == date
    );

    if (existingIndex >= 0) {
      project.labourAttendance[existingIndex].present = Boolean(present);
    } else {
      project.labourAttendance = [
        ...(project.labourAttendance || []),
        {
          id: (project.labourAttendance?.length || 0) + 1,
          workerId,
          date,
          present: Boolean(present)
        }
      ];
    }

    project.markModified("labourAttendance");
    await project.save();

    res.json({ success: true, labourAttendance: project.labourAttendance });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add material to inventory
router.post(["/material", "/projects/material"], async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const { projectId, name, required, unit, supplier, received } = req.body;
    const project = await VendorProject.findOne({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
      projectId: projectId
    });

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const reqQty = Number(required) || 0;
    const recQty = Number(received) || 0;

    const newMat = {
      id: (project.inventory?.length || 0) + 1,
      projectId,
      name,
      required: reqQty,
      received: recQty,
      consumed: 0,
      balance: recQty,
      unit: unit || "bags",
      supplier: supplier || ""
    };

    project.inventory = [...(project.inventory || []), newMat];
    project.markModified("inventory");
    await project.save();

    res.json({ success: true, inventory: project.inventory });
  } catch (error) {
    console.error("Add material error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add change order
router.post(["/change-order", "/projects/change-order"], async (req, res) => {
  try {
    const userCode = getUserCode(req);
    if (!userCode) return res.status(400).json({ success: false, message: "userCode is required" });

    const { projectId, description, quantity, rate } = req.body;
    const project = await VendorProject.findOne({
      userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i"),
      projectId: projectId
    });

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const qty = Number(quantity) || 0;
    const r = Number(rate) || 0;

    const change = {
      id: (project.changeOrders?.length || 0) + 1,
      projectId,
      description,
      quantity: qty,
      rate: r,
      amount: qty * r,
      status: "Pending",
      date: new Date().toISOString().split("T")[0]
    };

    project.changeOrders = [...(project.changeOrders || []), change];
    project.markModified("changeOrders");
    await project.save();

    res.json({ success: true, changeOrders: project.changeOrders });
  } catch (error) {
    console.error("Add change-order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

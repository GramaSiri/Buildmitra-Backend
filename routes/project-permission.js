const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const User = require("../models/User");
const Counter = require("../models/Counter");

async function generateProjectCode() {
  const counter = await Counter.findOneAndUpdate(
    { key: "PRJ" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `PRJ-${String(counter.seq).padStart(6, "0")}`;
}

// Helper to escape regex special characters
function escapeRegex(str) {
  return String(str || "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Create project
router.post("/create", async (req, res) => {
  try {
    const { projectName, name, ownerUserCode, ownerName, city, buyerCode, contractorCode } = req.body;
    const effectiveOwner = ownerUserCode || buyerCode || req.headers["x-user-code"];

    if (!projectName && !name) {
      return res.status(400).json({
        success: false,
        message: "projectName is required"
      });
    }

    const projectCode = req.body.projectCode || await generateProjectCode();

    const projectData = {
      ...req.body,
      projectName: projectName || name,
      name: projectName || name,
      projectCode,
      ownerUserCode: effectiveOwner || "USER-000001",
      buyerCode: buyerCode || effectiveOwner || "",
      contractorCode: contractorCode || req.body.contractorCode || "",
      city: city || req.body.location || "",
      assignedUsers: req.body.assignedUsers || []
    };

    const project = await Project.findOneAndUpdate(
      { projectCode },
      { $set: projectData },
      { new: true, upsert: true }
    );

    if (effectiveOwner) {
      await User.updateOne(
        { userCode: new RegExp(`^${escapeRegex(effectiveOwner)}$`, "i") },
        {
          $addToSet: {
            assignedProjects: {
              projectCode,
              projectName: project.projectName,
              accessRole: "owner"
            }
          }
        }
      ).catch(() => {});
    }

    res.json({ success: true, project });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save or sync single project or array of projects
router.post("/save", async (req, res) => {
  try {
    const userCode = req.headers["x-user-code"] || req.query.userCode || req.body.userCode || "";
    const items = Array.isArray(req.body) ? req.body : req.body.projects ? req.body.projects : [req.body];
    const savedProjects = [];

    for (const item of items) {
      if (!item) continue;
      const pName = item.projectName || item.name || "Untitled Project";
      let code = item.projectCode;
      
      const query = [];
      if (code) query.push({ projectCode: code });
      if (item.projectUniqueId) query.push({ projectUniqueId: String(item.projectUniqueId) });
      if (item._id) query.push({ _id: item._id });
      if (item.id && typeof item.id === "string" && item.id.startsWith("PRJ-")) {
        query.push({ projectCode: item.id });
      }

      let existing = null;
      if (query.length > 0) {
        existing = await Project.findOne({ $or: query });
      }

      if (!existing && !code) {
        code = await generateProjectCode();
      } else if (existing && !code) {
        code = existing.projectCode;
      }

      const effectiveOwner = item.ownerUserCode || item.buyerCode || userCode || (existing ? existing.ownerUserCode : "USER-000001");

      const updateData = {
        ...item,
        projectName: pName,
        name: pName,
        projectCode: code,
        ownerUserCode: effectiveOwner,
        buyerCode: item.buyerCode || effectiveOwner,
        contractorCode: item.contractorCode || (existing ? existing.contractorCode : ""),
        updatedAt: new Date()
      };

      delete updateData._id;

      const saved = await Project.findOneAndUpdate(
        { projectCode: code },
        { $set: updateData },
        { new: true, upsert: true }
      );
      savedProjects.push(saved);
    }

    res.json({
      success: true,
      count: savedProjects.length,
      projects: savedProjects,
      project: savedProjects[0] || null
    });
  } catch (error) {
    console.error("Save project error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign user to project
router.post("/assign-user", async (req, res) => {
  try {
    const { projectCode, userCode, accessRole } = req.body;

    const project = await Project.findOne({ projectCode });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const user = await User.findOne({ userCode: new RegExp(`^${escapeRegex(userCode)}$`, "i") });
    if (!user) {
      return res.status(404).json({ success: false, message: "User code not found" });
    }

    await Project.updateOne(
      { projectCode },
      {
        $addToSet: {
          assignedUsers: {
            userCode: user.userCode,
            role: accessRole || user.businessRole,
            name: user.name,
            email: user.email,
            phone: user.phone
          }
        }
      }
    );

    await User.updateOne(
      { userCode: user.userCode },
      {
        $addToSet: {
          assignedProjects: {
            projectCode: project.projectCode,
            projectName: project.projectName,
            accessRole: accessRole || user.businessRole
          }
        }
      }
    );

    res.json({ success: true, message: "User assigned to project successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record milestone payment
router.post("/payment", async (req, res) => {
  try {
    const {
      projectCode,
      projectId,
      milestoneId,
      milestoneName,
      amount,
      paymentDate,
      paymentMode,
      paymentReference,
      chequeNo,
      utrNo,
      userCode,
      remarks
    } = req.body;

    const query = [];
    if (projectCode) query.push({ projectCode });
    if (projectId) query.push({ projectUniqueId: String(projectId) }, { id: projectId });

    if (query.length === 0) {
      return res.status(400).json({ success: false, message: "projectCode or projectId is required" });
    }

    const project = await Project.findOne({ $or: query });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const payAmount = Number(amount) || 0;
    const payDate = paymentDate || new Date().toISOString().split("T")[0];

    // Update matching milestone if milestoneId is provided
    let milestoneUpdated = false;
    if (Array.isArray(project.milestones)) {
      project.milestones = project.milestones.map((m) => {
        if (
          (milestoneId && (m.id == milestoneId || m._id == milestoneId)) ||
          (milestoneName && m.name === milestoneName)
        ) {
          milestoneUpdated = true;
          return {
            ...m,
            actualPaymentAmount: (Number(m.actualPaymentAmount) || 0) + payAmount,
            paymentDate: payDate,
            paymentReleased: true,
            status: "Paid",
            chequeNo: chequeNo || m.chequeNo || "",
            utrNo: utrNo || m.utrNo || paymentReference || ""
          };
        }
        return m;
      });
    }

    // Append to payments history array
    const paymentRecord = {
      paymentId: `PAY-${Date.now()}`,
      milestoneId,
      milestoneName: milestoneName || (milestoneId ? `Milestone #${milestoneId}` : "General Payment"),
      amount: payAmount,
      date: payDate,
      mode: paymentMode || "Online",
      reference: paymentReference || utrNo || chequeNo || "",
      chequeNo: chequeNo || "",
      utrNo: utrNo || "",
      userCode: userCode || req.headers["x-user-code"] || project.ownerUserCode,
      remarks: remarks || "",
      status: "Paid",
      createdAt: new Date()
    };

    if (!Array.isArray(project.payments)) {
      project.payments = [];
    }
    project.payments.unshift(paymentRecord);

    await project.save();

    res.json({
      success: true,
      message: "Payment recorded successfully",
      payment: paymentRecord,
      project
    });
  } catch (error) {
    console.error("Record payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get projects visible for one user (Owner, Buyer, Contractor, Vendor, or Assigned User)
router.get("/my-projects/:userCode", async (req, res) => {
  try {
    const { userCode } = req.params;
    const cleanCode = String(userCode || "").trim();
    if (!cleanCode) {
      return res.json({ success: true, projects: [] });
    }

    const regex = new RegExp(`^${escapeRegex(cleanCode)}$`, "i");

    const projects = await Project.find({
      $or: [
        { ownerUserCode: regex },
        { buyerCode: regex },
        { contractorCode: regex },
        { vendorCode: regex },
        { "assignedUsers.userCode": regex }
      ]
    }).sort({ updatedAt: -1, createdAt: -1 });

    res.json({ success: true, count: projects.length, projects });
  } catch (error) {
    console.error("Get my-projects error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

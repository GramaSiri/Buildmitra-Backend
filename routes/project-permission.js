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

// Create project
router.post("/create", async (req, res) => {
  try {
    const { projectName, ownerUserCode, ownerName, city } = req.body;

    if (!projectName || !ownerUserCode) {
      return res.status(400).json({
        success: false,
        message: "projectName and ownerUserCode are required"
      });
    }

    const projectCode = await generateProjectCode();

    const project = new Project({
      projectName,
      projectCode,
      ownerUserCode,
      ownerName,
      city,
      assignedUsers: []
    });

    await project.save();

    await User.updateOne(
      { userCode: ownerUserCode },
      {
        $addToSet: {
          assignedProjects: {
            projectCode,
            projectName,
            accessRole: "owner"
          }
        }
      }
    );

    res.json({ success: true, project });
  } catch (error) {
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

    const user = await User.findOne({ userCode });
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
      { userCode },
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

// Get projects visible for one user
router.get("/my-projects/:userCode", async (req, res) => {
  try {
    const { userCode } = req.params;

    const projects = await Project.find({
      $or: [
        { ownerUserCode: userCode },
        { "assignedUsers.userCode": userCode }
      ]
    });

    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

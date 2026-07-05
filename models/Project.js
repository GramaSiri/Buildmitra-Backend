const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },

  projectCode: {
    type: String,
    unique: true,
    sparse: true
  },

  ownerUserCode: { type: String, required: true },
  ownerName: { type: String },
  city: { type: String },

  status: {
    type: String,
    default: "active"
  },

  assignedUsers: [{
    userCode: String,
    role: String,
    name: String,
    email: String,
    phone: String
  }],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Project", ProjectSchema);

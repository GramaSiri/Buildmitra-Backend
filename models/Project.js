const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    projectName: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    projectCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    projectUniqueId: { type: String, index: true },
    id: { type: mongoose.Schema.Types.Mixed },

    ownerUserCode: { type: String, required: true, index: true },
    ownerName: { type: String, trim: true },
    buyerCode: { type: String, index: true, trim: true },
    buyerName: { type: String, trim: true },
    contractorCode: { type: String, index: true, trim: true },
    contractorName: { type: String, trim: true },
    contractorId: { type: mongoose.Schema.Types.Mixed },
    vendorCode: { type: String, index: true, trim: true },

    city: { type: String, trim: true },
    location: { type: String, trim: true },
    status: {
      type: String,
      default: "active"
    },
    budget: { type: Number, default: 0 },
    startDate: { type: String },
    endDate: { type: String },
    floors: { type: Number, default: 1 },
    builtUpArea: { type: Number, default: 0 },
    plotLength: { type: Number, default: 0 },
    plotWidth: { type: Number, default: 0 },

    milestones: { type: Array, default: [] },
    materials: { type: Array, default: [] },
    labour: { type: Array, default: [] },
    payments: { type: Array, default: [] },
    extraWork: { type: Array, default: [] },
    siteMedia: { type: Array, default: [] },
    notes: { type: Array, default: [] },
    permissions: { type: Object, default: {} },

    assignedUsers: [
      {
        userCode: { type: String, index: true },
        role: String,
        name: String,
        email: String,
        phone: String
      }
    ]
  },
  {
    strict: false,
    timestamps: true
  }
);

ProjectSchema.index({ ownerUserCode: 1, createdAt: -1 });
ProjectSchema.index({ buyerCode: 1, createdAt: -1 });
ProjectSchema.index({ contractorCode: 1, createdAt: -1 });
ProjectSchema.index({ "assignedUsers.userCode": 1, createdAt: -1 });

module.exports = mongoose.model("Project", ProjectSchema);

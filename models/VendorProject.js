const mongoose = require("mongoose");

const VendorProjectSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.Mixed, required: true },
    name: { type: String, required: true },
    client: { type: String, default: "" },
    clientMobile: { type: String, default: "" },
    location: { type: String, default: "" },
    bua: { type: Number, default: 0 },
    contractRate: { type: Number, default: 1800 },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    totalAmount: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    status: { type: String, default: "In Progress" },
    paymentReceived: { type: Number, default: 0 },
    balancePayment: { type: Number, default: 0 },

    milestones: { type: Array, default: [] },
    workers: { type: Array, default: [] },
    inventory: { type: Array, default: [] },
    claims: { type: Array, default: [] },
    changeOrders: { type: Array, default: [] },
    siteMedia: { type: Array, default: [] },
    labourAttendance: { type: Array, default: [] }
  },
  { strict: false, timestamps: true }
);

module.exports = mongoose.model("VendorProject", VendorProjectSchema);

const mongoose = require("mongoose");

const LabourWorkerSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    workerCode: { type: String, index: true },
    name: { type: String, required: true },
    skill: { type: String, default: "Helper" },
    dailyWage: { type: Number, default: 500 },
    mobile: { type: String, default: "" },
    experience: { type: String, default: "1 year" },
    rating: { type: Number, default: 4.0 },
    status: { type: String, default: "Available" },
    projectId: { type: mongoose.Schema.Types.Mixed, default: null },
    projectName: { type: String, default: "" },
    jobAllocated: { type: String, default: "" },
    workingTimings: { type: String, default: "08:30 AM - 05:30 PM" },
    basicWage: { type: Number, default: 0 },
    totalCtcSalary: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const LabourAttendanceSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    workerId: { type: mongoose.Schema.Types.Mixed, required: true },
    workerCode: { type: String, default: "" },
    workerName: { type: String, default: "" },
    projectId: { type: mongoose.Schema.Types.Mixed, default: null },
    projectName: { type: String, default: "" },
    date: { type: String, required: true, index: true },
    present: { type: Boolean, default: true },
    hours: { type: Number, default: 8 },
    overtime: { type: Number, default: 0 },
    wageAmount: { type: Number, default: 0 },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    isGeofenceValid: { type: Boolean, default: true },
    attendanceStatus: { type: String, default: "Present" },
    remarks: { type: String, default: "" }
  },
  { timestamps: true }
);

const LabourAssignmentSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    workerId: { type: mongoose.Schema.Types.Mixed, required: true },
    workerName: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.Mixed, required: true },
    projectName: { type: String, default: "" },
    assignedDate: { type: String, default: "" },
    dailyRate: { type: Number, default: 500 },
    status: { type: String, default: "Active" }
  },
  { timestamps: true }
);

const LabourRateCardSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    skill: { type: String, required: true },
    baseRate: { type: Number, default: 500 },
    overtimeRate: { type: Number, default: 75 },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

const LabourInvoiceSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    client: { type: String, default: "" },
    project: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    date: { type: String, default: "" },
    status: { type: String, default: "Pending" }
  },
  { timestamps: true }
);

module.exports = {
  LabourWorker: mongoose.model("LabourWorker", LabourWorkerSchema),
  LabourAttendance: mongoose.model("LabourAttendance", LabourAttendanceSchema),
  LabourAssignment: mongoose.model("LabourAssignment", LabourAssignmentSchema),
  LabourRateCard: mongoose.model("LabourRateCard", LabourRateCardSchema),
  LabourInvoice: mongoose.model("LabourInvoice", LabourInvoiceSchema)
};

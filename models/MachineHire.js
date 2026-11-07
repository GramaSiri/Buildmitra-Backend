const mongoose = require("mongoose");

const MachineListingSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    machineCode: { type: String, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "Earth Moving" },
    model: { type: String, default: "2024" },
    dailyRate: { type: Number, default: 0 },
    weeklyRate: { type: Number, default: 0 },
    monthlyRate: { type: Number, default: 0 },
    status: { type: String, default: "Available" },
    operatorRequired: { type: Boolean, default: false },
    operatorCost: { type: Number, default: 0 },
    fuelType: { type: String, default: "Diesel" },
    description: { type: String, default: "" },
    images: { type: Array, default: [] },
    documents: { type: Array, default: [] }
  },
  { timestamps: true }
);

const MachineRentalSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    machineId: { type: mongoose.Schema.Types.Mixed, required: true },
    machineName: { type: String, required: true },
    clientId: { type: mongoose.Schema.Types.Mixed, default: null },
    clientName: { type: String, default: "" },
    clientMobile: { type: String, default: "" },
    projectName: { type: String, default: "" },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    actualEndDate: { type: String, default: null },
    dailyRate: { type: Number, default: 0 },
    operatorIncluded: { type: Boolean, default: false },
    totalDays: { type: Number, default: 1 },
    totalAmount: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    status: { type: String, default: "Active" }
  },
  { timestamps: true }
);

const MachineMaintenanceSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    machineId: { type: mongoose.Schema.Types.Mixed, required: true },
    machineName: { type: String, required: true },
    serviceDate: { type: String, default: "" },
    nextDueDate: { type: String, default: "" },
    serviceType: { type: String, default: "Preventive" },
    cost: { type: Number, default: 0 },
    mechanic: { type: String, default: "" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

const MachineInvoiceSchema = new mongoose.Schema(
  {
    userCode: { type: String, required: true, index: true },
    rentalId: { type: mongoose.Schema.Types.Mixed },
    machineName: { type: String, default: "" },
    clientName: { type: String, default: "" },
    projectName: { type: String, default: "" },
    period: { type: String, default: "" },
    totalDays: { type: Number, default: 1 },
    dailyRate: { type: Number, default: 0 },
    operatorCost: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, default: "Pending" },
    date: { type: String, default: "" },
    dueDate: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = {
  MachineListing: mongoose.model("MachineListing", MachineListingSchema),
  MachineRental: mongoose.model("MachineRental", MachineRentalSchema),
  MachineMaintenance: mongoose.model("MachineMaintenance", MachineMaintenanceSchema),
  MachineInvoice: mongoose.model("MachineInvoice", MachineInvoiceSchema)
};

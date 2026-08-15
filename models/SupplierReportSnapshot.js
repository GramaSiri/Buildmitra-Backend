const mongoose = require("mongoose");

const SupplierReportSnapshotSchema = new mongoose.Schema(
  {
    snapshotCode: { type: String, required: true, unique: true },
    providerUserCode: { type: String, required: true, index: true, uppercase: true },
    reportType: {
      type: String,
      enum: ["customer_wise", "payment_pending", "total_business", "full_statement"],
      default: "full_statement"
    },
    title: { type: String, default: "Supplier Business Statement" },
    totalBusinessDone: { type: Number, default: 0 },
    totalQuotedBusiness: { type: Number, default: 0 },
    pendingPayments: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    customerCount: { type: Number, default: 0 },
    reportData: { type: Array, default: [] },
    notes: { type: String, default: "" },
    generatedBy: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplierReportSnapshot", SupplierReportSnapshotSchema);

const mongoose = require("mongoose");

const SupplierOrderSchema = new mongoose.Schema(
  {
    supplierUserCode: { type: String, required: true, index: true },
    buyerUserCode: { type: String, default: "", index: true },
    buyerName: { type: String, default: "" },
    buyerPhone: { type: String, default: "" },
    orderId: { type: String, required: true, unique: true, index: true },
    items: [
      {
        itemName: String,
        quantity: Number,
        unit: String,
        price: Number,
        total: Number
      }
    ],
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Dispatched", "Delivered", "Cancelled"],
      default: "Pending",
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Partially Paid"],
      default: "Paid"
    },
    orderDate: { type: String, default: "" },
    dispatchDate: { type: String, default: null },
    deliveryDate: { type: String, default: null },
    trackingNumber: { type: String, default: "" },
    shippingAddress: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplierOrder", SupplierOrderSchema);

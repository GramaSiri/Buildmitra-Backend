import mongoose from 'mongoose';

const boqItemSchema = new mongoose.Schema({
  activity: { type: String, required: true },              // e.g., "Footing Concrete"
  material: { type: String, required: true },              // e.g., "Ultratech Cement"
  materialQty: { type: Number, required: true },           // e.g., 150
  materialUnit: { type: String, required: true },          // e.g., "bags"
  materialRate: { type: Number },                          // ₹ per unit
  materialAmount: { type: Number },                        // Qty × Rate
  labourType: { type: String },                            // e.g., "Mason"
  labourQty: { type: Number },                             // e.g., 12
  labourUnit: { type: String },                            // e.g., "days"
  labourRate: { type: Number },                            // ₹ per unit
  labourAmount: { type: Number },                          // Qty × Rate
  totalAmount: { type: Number },                           // Material + Labour
  remarks: { type: String }                                // e.g., "M20 mix, 1:1.5:3 ratio"
});

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  clientName: { type: String, required: true },
  siteAddress: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  assignedVendors: [{ type: String }],
  assignedContractors: [{ type: String }],
  assignedLabour: [{ type: String }],
  status: { type: String, default: 'Planned' },            // Planned, In Progress, Completed
  boqItems: [boqItemSchema]
});

export default mongoose.model('Project', projectSchema);
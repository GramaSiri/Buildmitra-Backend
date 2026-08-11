const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

const boqItems = [
  {
    primaryCode: "MAT-WTR-TNK",
    itemName: "UG Sump Tank + OHT + Inspection Chambers + MS Gate + SS Railings Set",
    category: "Utilities & Civil Set",
    unit: "LS",
    materialRate: 120000,
    labourCode: "LAB-WTR-TNK",
    labourName: "UG Sump + OHT Installation & Fabrication Labour",
    labourRate: 35000,
  },
  {
    primaryCode: "SRV-PCC-01",
    itemName: "PCC Bedding & Levelling Civil Service",
    category: "Civil Substructure",
    unit: "CUM",
    materialRate: 3800,
    labourCode: "LAB-PCC-01",
    labourName: "PCC Bedding Pouring & Surface Levelling Labour",
    labourRate: 800,
  },
  {
    primaryCode: "PLB-18",
    itemName: "Concealed CPVC/SWR Plumbing Lines & Fixtures Set",
    category: "Plumbing",
    unit: "SET",
    materialRate: 18500,
    labourCode: "LAB-PLB-18",
    labourName: "Plumbing Concealed Piping & Sanitary Fitting Labour",
    labourRate: 4500,
  },
  {
    primaryCode: "ELEC-15",
    itemName: "Concealed Electrical Conduit Boxes & Wire Complete Set",
    category: "Electrical",
    unit: "SET",
    materialRate: 15000,
    labourCode: "LAB-ELEC-15",
    labourName: "Electrical Conduit Chasing & Wiring Fixing Labour",
    labourRate: 4000,
  },
  {
    primaryCode: "FCL-12",
    itemName: "Gypsum Board False Ceiling Grid System",
    category: "Interior Finishes",
    unit: "SQFT",
    materialRate: 85,
    labourCode: "LAB-FCL-12",
    labourName: "False Ceiling Metal Grid Framing & Sheet Fixing Labour",
    labourRate: 35,
  }
];

async function seedBOQItems() {
  try {
    console.log("Connecting to MongoDB for BOQ item seeding...");
    await mongoose.connect(mongoUri);

    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");

    for (const b of boqItems) {
      // 1. Primary Material / Service Record
      const primaryType = b.primaryCode.startsWith("SRV") ? "service" : "material";
      await MasterItem.findOneAndUpdate(
        { masterItemCode: b.primaryCode },
        {
          $set: {
            masterItemCode: b.primaryCode,
            itemType: primaryType,
            category: b.category,
            itemName: b.itemName,
            unit: b.unit,
            referenceRate: b.materialRate,
            primaryMasterItemCode: b.primaryCode,
            linkedLabourItemCode: b.labourCode,
            rateComponent: "primary",
            status: "active",
            createdBy: "admin"
          }
        },
        { upsert: true, new: true }
      );

      await MarketRate.findOneAndUpdate(
        { $or: [{ masterItemCode: b.primaryCode }, { itemCode: b.primaryCode }] },
        {
          $set: {
            masterItemCode: b.primaryCode,
            itemCode: b.primaryCode,
            itemName: b.itemName,
            itemType: primaryType,
            category: b.category,
            unit: b.unit,
            currentRate: b.materialRate,
            primaryMasterItemCode: b.primaryCode,
            linkedLabourItemCode: b.labourCode,
            rateComponent: "primary",
            city: "Bengaluru",
            state: "Karnataka",
            approvalStatus: "approved",
            isActive: true,
            sourceType: "admin_manual",
            sourceName: "BuildMitra Master Database"
          }
        },
        { upsert: true, new: true }
      );

      // 2. Linked Labour Record
      await MasterItem.findOneAndUpdate(
        { masterItemCode: b.labourCode },
        {
          $set: {
            masterItemCode: b.labourCode,
            itemType: "labour",
            category: b.category,
            itemName: b.labourName,
            unit: b.unit,
            referenceRate: b.labourRate,
            primaryMasterItemCode: b.primaryCode,
            linkedLabourItemCode: b.labourCode,
            rateComponent: "labour",
            status: "active",
            createdBy: "admin"
          }
        },
        { upsert: true, new: true }
      );

      await MarketRate.findOneAndUpdate(
        { $or: [{ masterItemCode: b.labourCode }, { itemCode: b.labourCode }] },
        {
          $set: {
            masterItemCode: b.labourCode,
            itemCode: b.labourCode,
            itemName: b.labourName,
            itemType: "labour",
            category: b.category,
            unit: b.unit,
            currentRate: b.labourRate,
            primaryMasterItemCode: b.primaryCode,
            linkedLabourItemCode: b.labourCode,
            rateComponent: "labour",
            city: "Bengaluru",
            state: "Karnataka",
            approvalStatus: "approved",
            isActive: true,
            sourceType: "admin_manual",
            sourceName: "BuildMitra Master Database"
          }
        },
        { upsert: true, new: true }
      );

      console.log(`Seeded BOQ Pair: ${b.primaryCode} (Material: ₹${b.materialRate}) + ${b.labourCode} (Labour: ₹${b.labourRate}) => Total: ₹${b.materialRate + b.labourRate}`);
    }

    console.log("ALL LINKED BOQ ITEMS SEEDED SUCCESSFULLY");
    await mongoose.disconnect();
  } catch (err) {
    console.error("BOQ Seed Error:", err);
  }
}

seedBOQItems();

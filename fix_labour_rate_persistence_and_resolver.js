const mongoose = require("mongoose");
require("dotenv").config({ path: "D:\\images\\Desktop\\BMBackend\\.env" });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/buildmitra";

const targetBOQPairs = [
  {
    primaryCode: "MAT-WTR-TNK",
    itemName: "UG Sump (6000L) + OHT (2000L) + inspection chambers + MS Gate + Stainless Steel Railings",
    itemType: "material",
    category: "Water Tank & External Works",
    unit: "LS",
    materialRate: 120000,
    labourCode: "LAB-WTR-TNK",
    labourName: "UG Sump + OHT Installation & Fabrication Labour",
    labourRate: 35000,
  },
  {
    primaryCode: "SRV-PCC-01",
    itemName: "PCC Bedding & Levelling Civil Service",
    itemType: "service",
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
    itemType: "material",
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
    itemType: "material",
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
    itemType: "material",
    category: "Interior Finishes",
    unit: "SQFT",
    materialRate: 85,
    labourCode: "LAB-FCL-12",
    labourName: "False Ceiling Metal Grid Framing & Sheet Fixing Labour",
    labourRate: 35,
  }
];

async function fixLabourPersistence() {
  try {
    console.log("Connecting to MongoDB for Linked Labour Rate Persistence Fix...");
    await mongoose.connect(mongoUri);

    const MasterItem = require("./models/MasterItem");
    const MarketRate = require("./models/MarketRate");

    for (const pair of targetBOQPairs) {
      // 1. Primary Material/Service MasterItem
      await MasterItem.findOneAndUpdate(
        { masterItemCode: pair.primaryCode },
        {
          $set: {
            masterItemCode: pair.primaryCode,
            itemType: pair.itemType,
            category: pair.category,
            itemName: pair.itemName,
            unit: pair.unit,
            referenceRate: pair.materialRate,
            rate: pair.materialRate,
            primaryMasterItemCode: pair.primaryCode,
            linkedLabourItemCode: pair.labourCode,
            rateComponent: "primary",
            status: "active",
            createdBy: "admin",
            updatedBy: "admin"
          }
        },
        { upsert: true, new: true }
      );

      // Primary MarketRate
      await MarketRate.findOneAndUpdate(
        { $or: [{ masterItemCode: pair.primaryCode }, { itemCode: pair.primaryCode }] },
        {
          $set: {
            masterItemCode: pair.primaryCode,
            itemCode: pair.primaryCode,
            itemName: pair.itemName,
            itemType: pair.itemType,
            category: pair.category,
            unit: pair.unit,
            currentRate: pair.materialRate,
            rate: pair.materialRate,
            referenceRate: pair.materialRate,
            primaryMasterItemCode: pair.primaryCode,
            linkedLabourItemCode: pair.labourCode,
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

      // 2. Linked Labour MasterItem
      await MasterItem.findOneAndUpdate(
        { masterItemCode: pair.labourCode },
        {
          $set: {
            masterItemCode: pair.labourCode,
            itemType: "labour",
            category: pair.category,
            itemName: pair.labourName,
            unit: pair.unit,
            referenceRate: pair.labourRate,
            rate: pair.labourRate,
            primaryMasterItemCode: pair.primaryCode,
            linkedLabourItemCode: pair.labourCode,
            rateComponent: "labour",
            status: "active",
            createdBy: "admin",
            updatedBy: "admin"
          }
        },
        { upsert: true, new: true }
      );

      // Linked Labour MarketRate
      await MarketRate.findOneAndUpdate(
        { $or: [{ masterItemCode: pair.labourCode }, { itemCode: pair.labourCode }] },
        {
          $set: {
            masterItemCode: pair.labourCode,
            itemCode: pair.labourCode,
            itemName: pair.labourName,
            itemType: "labour",
            category: pair.category,
            unit: pair.unit,
            currentRate: pair.labourRate,
            rate: pair.labourRate,
            referenceRate: pair.labourRate,
            primaryMasterItemCode: pair.primaryCode,
            linkedLabourItemCode: pair.labourCode,
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

      console.log(`PERSISTED LABOUR PAIR: ${pair.primaryCode} (Material: ₹${pair.materialRate}) + ${pair.labourCode} (Labour: ₹${pair.labourRate}) => Total: ₹${pair.materialRate + pair.labourRate}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error("Labour persistence error:", err);
  }
}

fixLabourPersistence();

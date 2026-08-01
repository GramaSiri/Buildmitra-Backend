require("dotenv").config();
const mongoose = require("mongoose");
const RealEstateProperty = require("./models/RealEstateProperty");

const LEGACY_FALLBACKS = {
  "REP-000001": [
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80"
  ],
  "REP-000002": [
    "https://images.unsplash.com/photo-1524813686514-a57563d77965?auto=format&fit=crop&w=1000&q=80"
  ],
  "REP-000003": [
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80"
  ],
  "REP-000004": [
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80"
  ]
};

async function reconcileDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for Reconciliation...");

    const properties = await RealEstateProperty.find({});

    for (const p of properties) {
      const code = p.propertyCode;
      
      p.status = "Available";
      p.approvalStatus = "Approved";
      p.isActive = true;
      p.isBlocked = false;

      if (!p.providerUserCode) p.providerUserCode = "REA-000002";
      if (!p.providerName) p.providerName = "Garden Greens Consultants";
      if (!p.providerPhone) p.providerPhone = "9986553549";

      const legacyImgs = LEGACY_FALLBACKS[code] || [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80"
      ];

      if (!Array.isArray(p.images) || p.images.length === 0) {
        p.images = legacyImgs;
        p.imageUrls = legacyImgs;
        p.coverImage = legacyImgs[0];
        p.imageUrl = legacyImgs[0];
      }

      await p.save();
      console.log(`✅ Reconciled property ${code} (${p.title}) -> Status: Available, Approval: Approved, Imgs: ${p.images.length}`);
    }

    console.log("🎉 Reconciliation complete!");
    process.exit(0);
  } catch (err) {
    console.error("Reconciliation error:", err);
    process.exit(1);
  }
}

reconcileDatabase();

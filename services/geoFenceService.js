/**
 * BuildMitra Geo-Fence Service
 * 5.0 km Radius Haversine Distance Engine & Supplier Geo-Matching
 */

// Pincode GPS Coordinates Lookup Table for Major Regional Hubs
const PINCODE_COORDINATES = {
  "560068": { lat: 12.9260, lon: 77.6762, name: "Bellandur / Green Glen Layout, Bengaluru" },
  "560100": { lat: 12.8452, lon: 77.6602, name: "Electronic City Phase 1, Bengaluru" },
  "560102": { lat: 12.9121, lon: 77.6446, name: "HSR Layout, Bengaluru" },
  "560034": { lat: 12.9352, lon: 77.6245, name: "Koramangala, Bengaluru" },
  "560066": { lat: 12.9698, lon: 77.7500, name: "Whitefield, Bengaluru" },
  "560038": { lat: 12.9784, lon: 77.6408, name: "Indiranagar, Bengaluru" },
  "560037": { lat: 12.9569, lon: 77.7011, name: "Marathahalli, Bengaluru" },
  "560048": { lat: 12.9926, lon: 77.6974, name: "Hoodi / Mahadevapura, Bengaluru" },
  "560076": { lat: 12.8937, lon: 77.6163, name: "BTM Layout 2nd Stage, Bengaluru" },
  "560064": { lat: 13.0988, lon: 77.5960, name: "Yelahanka, Bengaluru" }
};

/**
 * Calculates Haversine distance between two (lat, lon) coordinates in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Gets GPS coordinates for a given pincode or defaults to Bellandur hub
 */
function getCoordinatesForPincode(pincode) {
  const cleanPin = String(pincode || "").trim();
  if (PINCODE_COORDINATES[cleanPin]) {
    return PINCODE_COORDINATES[cleanPin];
  }
  // Algorithmic coordinate estimation based on pincode hash offset for unknown pincodes
  const pinNum = parseInt(cleanPin) || 560068;
  const latOffset = ((pinNum % 100) - 50) * 0.005;
  const lonOffset = ((Math.floor(pinNum / 10) % 100) - 50) * 0.005;
  return {
    lat: 12.9260 + latOffset,
    lon: 77.6762 + lonOffset,
    name: `Pincode Area ${cleanPin}`
  };
}

/**
 * Seed Suppliers Data for Fallback Geo-Matching
 */
const DEFAULT_VERIFIED_SUPPLIERS = [
  {
    id: "SUPP-REG-01",
    companyName: "ABC Verified Registered Supplier",
    phone: "+91 7676942386",
    pincode: "560068",
    lat: 12.9265,
    lon: 77.6765,
    categories: ["CEMENT", "TMT STEEL", "BLOCKS", "SAND", "AGGREGATES", "TILES", "PAINT", "WATERPROOFING"],
    rating: 4.9
  },
  {
    id: "SUPP-REG-02",
    companyName: "Reddy Verified Material Vendor",
    phone: "+91 9731888377",
    pincode: "560068",
    lat: 12.9255,
    lon: 77.6755,
    categories: ["CEMENT", "TMT STEEL", "BLOCKS", "SAND", "AGGREGATES", "TILES", "PAINT", "WATERPROOFING"],
    rating: 4.9
  },
  {
    id: "SUPP-001",
    companyName: "Mahadev Steel & Cement Depot",
    phone: "+91 9888877771",
    pincode: "560068",
    lat: 12.9280,
    lon: 77.6790,
    categories: ["CEMENT", "TMT STEEL", "BLOCKS", "SAND"],
    rating: 4.9
  },
  {
    id: "SUPP-002",
    companyName: "Bangalore Civil Building Supplies",
    phone: "+91 9888877772",
    pincode: "560102",
    lat: 12.9150,
    lon: 77.6480,
    categories: ["CEMENT", "AGGREGATES", "SAND", "BLOCKS"],
    rating: 4.8
  }
];

/**
 * Main Geo-Fencing Matcher: Filters suppliers within 5.0 km radius
 */
async function filterSuppliersWithinRadius(buyerPincode, materialCategory, maxRadiusKm = 5.0) {
  const buyerCoords = getCoordinatesForPincode(buyerPincode);
  const targetCategory = (materialCategory || "CEMENT").toUpperCase();

  let allSuppliers = [...DEFAULT_VERIFIED_SUPPLIERS];

  // Also load registered vendors from data/users.json if present
  try {
    const fs = require("fs");
    const path = require("path");
    const jsonPath = path.join(__dirname, "../data/users.json");
    if (fs.existsSync(jsonPath)) {
      const fileData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      if (Array.isArray(fileData)) {
        fileData.forEach((u, idx) => {
          if (u.phone && (u.role === "vendor" || u.vendorType === "supplier" || u.role === "admin" || u.role === "user")) {
            const cleanPhone = String(u.phone).startsWith("+") ? String(u.phone) : `+91 ${u.phone}`;
            if (!allSuppliers.some(s => s.phone.includes(u.phone))) {
              allSuppliers.unshift({
                id: `SUPP-JSON-${idx + 1}`,
                companyName: `${u.name || "BuildMitra"} Registered Vendor`,
                phone: cleanPhone,
                pincode: u.pincode || buyerPincode,
                lat: buyerCoords.lat + 0.001 * (idx + 1),
                lon: buyerCoords.lon + 0.001 * (idx + 1),
                categories: ["CEMENT", "TMT STEEL", "BLOCKS", "SAND", "AGGREGATES", "TILES", "PAINT", "WATERPROOFING"],
                rating: 4.9
              });
            }
          }
        });
      }
    }
  } catch (err) {}

  // Try fetching registered suppliers from User model if available
  try {
    let User;
    try { User = require("../models/User"); } catch (e) {}
    if (User) {
      const dbUsers = await User.find({
        $or: [
          { businessRole: { $in: ["supplier", "vendor"] } },
          { role: "vendor" },
          { vendorType: "supplier" }
        ],
        isActive: true
      }).select("name phone pincode companyName categories").lean();

      if (dbUsers && dbUsers.length > 0) {
        dbUsers.forEach((u, idx) => {
          const sCoords = getCoordinatesForPincode(u.pincode || buyerPincode);
          const cleanPhone = String(u.phone).startsWith("+") ? String(u.phone) : `+91 ${u.phone}`;
          if (!allSuppliers.some(s => s.phone.includes(u.phone))) {
            allSuppliers.unshift({
              id: `SUPP-DB-${idx + 1}`,
              companyName: u.companyName || u.name || "BuildMitra Supplier",
              phone: cleanPhone,
              pincode: u.pincode || buyerPincode,
              lat: sCoords.lat,
              lon: sCoords.lon,
              categories: (u.categories || [targetCategory]).map((c) => c.toUpperCase()),
              rating: 4.8
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("GeoFence User lookup fallback:", err.message);
  }

  // Calculate Haversine distance for each supplier
  const calculatedSuppliers = allSuppliers.map((supplier) => {
    const sCoords = supplier.lat && supplier.lon 
      ? { lat: supplier.lat, lon: supplier.lon } 
      : getCoordinatesForPincode(supplier.pincode);

    const distance = calculateHaversineDistance(
      buyerCoords.lat,
      buyerCoords.lon,
      sCoords.lat,
      sCoords.lon
    );

    const categoryMatch = supplier.categories.some((c) => 
      c.includes(targetCategory) || targetCategory.includes(c) || c === "GENERAL"
    );

    return {
      ...supplier,
      distanceKm: distance,
      categoryMatch
    };
  });

  // Strict 5.0 km radius filter with category matching
  let matched = calculatedSuppliers.filter(
    (s) => s.categoryMatch && s.distanceKm <= maxRadiusKm
  );

  // If fewer than 3 suppliers within 5km, expand radius to 10km or pincode match to ensure competition
  if (matched.length < 3) {
    matched = calculatedSuppliers.filter(
      (s) => s.categoryMatch && (s.distanceKm <= 10.0 || s.pincode === buyerPincode)
    );
  }

  matched.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    buyerPincode,
    buyerCoords,
    targetCategory,
    radiusKm: maxRadiusKm,
    matchedCount: matched.length,
    suppliers: matched
  };
}

module.exports = {
  calculateHaversineDistance,
  getCoordinatesForPincode,
  filterSuppliersWithinRadius
};

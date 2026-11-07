const { Pool } = require("pg");
require("dotenv").config();

let pool = null;
let isPgConnected = false;

// Optional PostgreSQL integration:
// BuildMitra operates with MongoDB as its primary database and memoryStore as the real-time cache.
// Only initialize a PostgreSQL client pool if an explicit connection URL or PG host is provided in env.
const hasExplicitPgConfig = Boolean(
  process.env.DATABASE_URL ||
  (process.env.ENABLE_POSTGRES === "true" && (process.env.PGHOST || process.env.DB_HOST))
);

if (hasExplicitPgConfig) {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 3000
      });
    } else {
      pool = new Pool({
        host: process.env.PGHOST || process.env.DB_HOST,
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || process.env.DB_USER,
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
        database: process.env.PGDATABASE || process.env.DB_NAME,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
      });
    }

    pool.on("connect", () => {
      isPgConnected = true;
    });

    pool.on("error", (err) => {
      isPgConnected = false;
      if (process.env.DEBUG_POSTGRES === "true") {
        console.warn("⚠️ PostgreSQL client connection error:", err.message);
      }
    });

    // Test connection once quietly without repeating error loops
    pool.query("SELECT 1")
      .then(() => {
        isPgConnected = true;
      })
      .catch(() => {
        isPgConnected = false;
      });
  } catch (err) {
    pool = null;
    isPgConnected = false;
  }
}

// In-memory fallback dataset for seamless API execution
const memoryStore = {
  auctions: [
    {
      id: "BM-AUC-410",
      material_category: "CEMENT",
      brand_preference: "UltraTech / Birla Super / ACC",
      grade: "PPC",
      quantity: 200,
      unit: "BAGS",
      site_address: "Plot 42, Green Glen Layout, Bellandur, Bengaluru",
      site_pincode: "560068",
      delivery_deadline: "Tomorrow, by 11:00 AM",
      gst_percent: 28,
      payment_terms: "COD on Unloading",
      quality_standard: "ISI fresh stock",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(), // 5 hours countdown
      current_l1_rate: 345.00,
      buyer_id: "BUYER-101",
      buyer_name: "Reddy Constructions",
      buyer_phone: "+91 9876543210"
    },
    {
      id: "BM-AUC-411",
      material_category: "TMT STEEL",
      brand_preference: "Tata Tiscon / JSW Neosteel / Jindal Panther",
      grade: "Fe550D",
      quantity: 15,
      unit: "TONNES",
      site_address: "Site 18, Electronic City Phase 1, Bengaluru",
      site_pincode: "560100",
      delivery_deadline: "Day after tomorrow, by 2:00 PM",
      gst_percent: 18,
      payment_terms: "COD on Unloading",
      quality_standard: "ISI fresh stock",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(), // 5 hours countdown
      current_l1_rate: 58500.00,
      buyer_id: "BUYER-102",
      buyer_name: "Srinivas Infra",
      buyer_phone: "+91 9123456789"
    }
  ],
  bids: [
    {
      id: "BID-901",
      auction_id: "BM-AUC-410",
      vendor_id: "VEND-101",
      vendor_name: "Bangalore Cement Traders",
      vendor_phone: "+91 9888877771",
      vendor_rating: 4.9,
      basic_rate_per_unit: 250.00,
      gst_percent: 28,
      gst_amount: 70.00,
      freight_per_unit: 15.00,
      unloading_per_unit: 10.00,
      total_landed_rate: 345.00,
      total_order_value: 69000.00,
      can_deliver_on_time: true,
      created_at: new Date().toISOString()
    },
    {
      id: "BID-902",
      auction_id: "BM-AUC-410",
      vendor_id: "VEND-102",
      vendor_name: "Mahadev Steel & Cement",
      vendor_phone: "+91 9888877772",
      vendor_rating: 4.7,
      basic_rate_per_unit: 255.00,
      gst_percent: 28,
      gst_amount: 71.40,
      freight_per_unit: 16.00,
      unloading_per_unit: 10.00,
      total_landed_rate: 352.40,
      total_order_value: 70480.00,
      can_deliver_on_time: true,
      created_at: new Date().toISOString()
    }
  ],
  purchaseOrders: []
};

async function query(text, params = []) {
  if (pool && isPgConnected) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      isPgConnected = false;
      if (process.env.DEBUG_POSTGRES === "true") {
        console.warn("⚠️ Postgres query error:", err.message);
      }
    }
  }
  return { rows: [], rowCount: 0 };
}

module.exports = {
  pool,
  query,
  memoryStore,
  isPgConnected: () => Boolean(pool && isPgConnected)
};

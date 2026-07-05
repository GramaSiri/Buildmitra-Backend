const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "buildmitra_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  const [rows] = await pool.query("SELECT DATABASE() AS database_name, NOW() AS server_time");
  console.log("✅ MySQL connected:", rows[0]);
}

module.exports = {
  pool,
  testConnection
};
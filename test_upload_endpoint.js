const http = require("http");
const fs = require("fs");
const path = require("path");

// Test GET /api/health and POST /api/realestate/upload-images
function testHealth() {
  http.get("http://localhost:5000/api/health", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      console.log("Health status code:", res.statusCode);
      console.log("Health response:", data);
    });
  }).on("error", (err) => {
    console.error("Health check connection error:", err.message);
  });
}

testHealth();

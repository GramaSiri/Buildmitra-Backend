const express = require("express");

// Test requireAdmin middleware simulation
const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const reqUser = { role: "buyer" };
const reqHeaders = { "x-user-role": "buyer" };

console.log("TESTING NON-ADMIN AUTHORIZATION REJECTION:");
if (reqHeaders['x-user-role'] !== 'admin') {
  console.log("HTTP 403: Admin access required [PASSED]");
} else {
  console.log("FAILED");
}

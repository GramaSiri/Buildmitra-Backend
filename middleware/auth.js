const jwt = require("jsonwebtoken");
const User = require("../models/User");

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret || secret === "your_secret_key") {
    const error = new Error("JWT_SECRET is not securely configured");
    error.code = "JWT_SECRET_MISSING";
    throw error;
  }

  return secret;
}

async function authenticateToken(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      const fallbackCode = String(
        req.headers["x-user-code"] ||
        req.query.userCode ||
        req.query.providerUserCode ||
        req.query.buyerUserCode ||
        ""
      ).trim();

      if (fallbackCode) {
        const user = await User.findOne({
          userCode: new RegExp(`^${fallbackCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i")
        }).select("_id userCode role businessRole isActive blockedReason");

        if (user) {
          if (user.isActive === false) {
            return res.status(403).json({
              success: false,
              message: user.blockedReason || "This account has been blocked"
            });
          }
          req.user = user;
          req.userId = String(user._id);
          req.userCode = String(user.userCode || "");
          req.userRole = String(user.role || "").toLowerCase();
          req.businessRole = String(user.businessRole || "").toLowerCase();
          return next();
        }
      }

      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(match[1], getJwtSecret());

    const user = await User.findById(decoded.userId).select(
      "_id userCode role businessRole isActive blockedReason"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication account not found"
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: user.blockedReason || "This account has been blocked"
      });
    }

    req.user = user;
    req.userId = String(user._id);
    req.userCode = String(user.userCode || "");
    req.userRole = String(user.role || "").toLowerCase();
    req.businessRole = String(user.businessRole || "").toLowerCase();

    next();
  } catch (error) {
    if (error && error.code === "JWT_SECRET_MISSING") {
      console.error("Authentication configuration error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Authentication service is not configured"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token"
    });
  }
}

function requireAdmin(req, res, next) {
  if (
    String(req.userRole || "").toLowerCase() !== "admin" &&
    String(req.user?.role || "").toLowerCase() !== "admin"
  ) {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  getJwtSecret
};

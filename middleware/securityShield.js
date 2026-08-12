const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

function securityShield(app) {
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: {
        policy: "cross-origin"
      }
    })
  );

  const makeLimiter = (windowMs, limit) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests. Please wait and try again."
      }
    });

  // Normal API usage
  app.use("/api", makeLimiter(15 * 60 * 1000, 600));

  // Authentication / account abuse protection
  app.use("/api/auth/login", makeLimiter(15 * 60 * 1000, 30));
  app.use("/api/auth/register", makeLimiter(15 * 60 * 1000, 20));
  app.use("/api/auth/forgot-password", makeLimiter(15 * 60 * 1000, 20));

  // Commercial actions
  app.use("/api/enquiry", makeLimiter(10 * 60 * 1000, 120));
  app.use("/api/quote", makeLimiter(10 * 60 * 1000, 120));

  // Upload abuse protection
  app.use("/api/marketplace/upload-image", makeLimiter(15 * 60 * 1000, 50));
  app.use("/api/realestate", makeLimiter(15 * 60 * 1000, 300));

  // Conservative scanner blocking only.
  app.use((req, res, next) => {
    const ua = String(req.headers["user-agent"] || "");

    if (/sqlmap|nikto|masscan|dirbuster|gobuster|wpscan/i.test(ua)) {
      return res.status(403).json({
        success: false,
        message: "Request blocked."
      });
    }

    next();
  });
}

module.exports = securityShield;

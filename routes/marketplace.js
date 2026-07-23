const express = require("express");
const router = express.Router();
const MarketplaceListing = require("../models/MarketplaceListing");

router.get("/", async (req, res) => {
  try {
    const filter = {
      status: "approved",
      isActive: true,
      isBlocked: false
    };

    if (req.query.itemType) filter.itemType = req.query.itemType;
    if (req.query.category) filter.category = new RegExp(req.query.category, "i");
    if (req.query.city) filter.providerCity = new RegExp(req.query.city, "i");
    if (req.query.pincode) filter.providerPincode = String(req.query.pincode);

    if (req.query.search) {
      const s = new RegExp(req.query.search, "i");
      filter.$or = [
        { itemName: s },
        { brand: s },
        { category: s },
        { subCategory: s },
        { providerName: s },
        { providerCity: s },
        { location: s }
      ];
    }

    const sort = req.query.sort === "lowest" ? { rate: 1 } : { createdAt: -1 };

    const items = await MarketplaceListing.find(filter).sort(sort).limit(300);

    res.json({
      success: true,
      count: items.length,
      items,
      listings: items
    });
  } catch (err) {
    console.error("Marketplace route error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(__dirname, "../uploads/marketplace");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `mkt_${Date.now()}_${cleanName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload Product Image API
router.post("/upload-image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const relativeUrl = `/uploads/marketplace/${req.file.filename}`;
    return res.json({
      success: true,
      url: relativeUrl,
      fileName: req.file.filename,
      fileSize: req.file.size
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Image Approval API
router.post("/admin/approve-image", async (req, res) => {
  try {
    const { listingId, imageUrl, action } = req.body; // action: 'approved' | 'rejected'
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const img = listing.images.find(i => i.url === imageUrl);
    if (img) {
      img.status = action === "approved" ? "approved" : "rejected";
    }

    if (action === "approved" && (!listing.imageUrl || listing.imageUrl === "/placeholder-material.png")) {
      listing.imageUrl = imageUrl;
    }

    await listing.save();
    return res.json({ success: true, message: `Image ${action} successfully`, listing });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

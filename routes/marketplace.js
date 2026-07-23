const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const MarketplaceListing = require("../models/MarketplaceListing");

const uploadDir = path.join(__dirname, "../uploads/marketplace");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/pjpeg"];
  
  if (allowedExts.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, JPEG, PNG, and WEBP image files under 5MB are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per image
});

// GET Marketplace items
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

    const items = await MarketplaceListing.find(filter).sort(sort).limit(300).lean();

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

// Single Product Image Upload API
router.post("/upload-image", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    const relativeUrl = `/uploads/marketplace/${req.file.filename}`;
    return res.json({
      success: true,
      url: relativeUrl,
      fileName: req.file.filename,
      fileSize: req.file.size
    });
  });
});

// Multiple Product Images Upload API (Up to 5 images)
router.post("/upload-images", (req, res) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No image files uploaded" });
    }
    const files = req.files.map((file, index) => ({
      url: `/uploads/marketplace/${file.filename}`,
      fileName: file.filename,
      fileSize: file.size,
      isPrimary: index === 0
    }));
    return res.json({
      success: true,
      count: files.length,
      files,
      images: files.map(f => ({ url: f.url, isPrimary: f.isPrimary }))
    });
  });
});

// Admin Image Approval API
router.post("/admin/approve-image", async (req, res) => {
  try {
    const { listingId, imageUrl, action } = req.body; // action: 'approved' | 'rejected'
    const listing = await MarketplaceListing.findById(listingId);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const img = (listing.images || []).find(i => i.url === imageUrl);
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

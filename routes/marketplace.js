const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const mongoose = require("mongoose");
const { Readable } = require("stream");
const MarketplaceListing = require("../models/MarketplaceListing");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/pjpeg",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (
      ALLOWED_MIME_TYPES.has(file.mimetype) &&
      allowedExtensions.includes(extension)
    ) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "Only JPG, JPEG, PNG and WEBP image files under 5MB are allowed."
      )
    );
  },
});

function getImageBucket() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB is not connected.");
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "marketplaceImages",
  });
}

async function optimiseImage(file) {
  return sharp(file.buffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 84,
      effort: 4,
    })
    .toBuffer();
}

async function saveImageToMongo(file, req) {
  const bucket = getImageBucket();
  const buffer = await optimiseImage(file);

  const originalBaseName =
    path
      .basename(file.originalname || "product-image", path.extname(file.originalname || ""))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "product-image";

  const fileName =
    `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_` +
    `${originalBaseName}.webp`;

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: "image/webp",
      metadata: {
        originalName: file.originalname || "",
        originalMimeType: file.mimetype || "",
        originalSize: Number(file.size || 0),
        optimisedSize: buffer.length,
        uploadedAt: new Date(),
        source: "marketplace",
      },
    });

    uploadStream.on("error", reject);

    uploadStream.on("finish", () => {
      const id = String(uploadStream.id);

      resolve({
        id,
        url: `/api/marketplace/images/${id}`,
        fileName,
        fileSize: buffer.length,
        contentType: "image/webp",
      });
    });

    Readable.from(buffer).pipe(uploadStream);
  });
}

function runSingleUpload(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: `Upload error: ${error.message}`,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  });
}

function runMultipleUpload(req, res, next) {
  upload.array("images", 5)(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: `Upload error: ${error.message}`,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  });
}

/*
  Permanent Marketplace image delivery from MongoDB GridFS.
  Used by supplier, contractor, machine-hire, labour-supply and vendor listings.
*/
router.get("/images/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send("Invalid image ID");
    }

    const imageId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = getImageBucket();

    const files = await mongoose.connection.db
      .collection("marketplaceImages.files")
      .find({ _id: imageId })
      .limit(1)
      .toArray();

    if (!files.length) {
      return res.status(404).send("Image not found");
    }

    const file = files[0];

    res.set({
      "Content-Type": file.contentType || "image/webp",
      "Content-Length": file.length,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });

    bucket
      .openDownloadStream(imageId)
      .on("error", (error) => {
        console.error("Marketplace image read error:", error);

        if (!res.headersSent) {
          res.status(404).send("Image not found");
        } else {
          res.end();
        }
      })
      .pipe(res);
  } catch (error) {
    console.error("Marketplace image delivery error:", error);
    res.status(500).send("Could not load image");
  }
});

/*
  Single image upload.
*/
router.post("/upload-image", runSingleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file uploaded",
      });
    }

    const saved = await saveImageToMongo(req.file, req);

    return res.json({
      success: true,
      ...saved,
      image: {
        url: saved.url,
        isPrimary: true,
      },
    });
  } catch (error) {
    console.error("Single Marketplace image upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Image upload failed",
    });
  }
});

/*
  Multiple image upload, maximum five.
*/
router.post("/upload-images", runMultipleUpload, async (req, res) => {
  try {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    if (!uploadedFiles.length) {
      return res.status(400).json({
        success: false,
        message: "No image files uploaded",
      });
    }

    const files = [];

    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const saved = await saveImageToMongo(uploadedFiles[index], req);

      files.push({
        ...saved,
        isPrimary: index === 0,
      });
    }

    return res.json({
      success: true,
      count: files.length,
      files,
      images: files.map((file) => ({
        url: file.url,
        isPrimary: file.isPrimary,
      })),
    });
  } catch (error) {
    console.error("Multiple Marketplace image upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Images upload failed",
    });
  }
});

/*
  Public Marketplace listings from every supported provider role.
*/
router.get("/", async (req, res) => {
  try {
    const filter = {
      status: "approved",
      isActive: true,
      isBlocked: false,
    };

    if (req.query.itemType) {
      filter.itemType = req.query.itemType;
    }

    if (req.query.category) {
      filter.category = new RegExp(req.query.category, "i");
    }

    if (req.query.city) {
      filter.providerCity = new RegExp(req.query.city, "i");
    }

    if (req.query.pincode) {
      filter.providerPincode = String(req.query.pincode);
    }

    if (req.query.search) {
      const search = new RegExp(req.query.search, "i");

      filter.$or = [
        { itemName: search },
        { brand: search },
        { category: search },
        { subCategory: search },
        { providerName: search },
        { providerCity: search },
        { location: search },
      ];
    }

    const sort =
      req.query.sort === "lowest"
        ? { rate: 1 }
        : { createdAt: -1 };

    const items = await MarketplaceListing.find(filter)
      .sort(sort)
      .limit(300)
      .lean();

    return res.json({
      success: true,
      count: items.length,
      items,
      listings: items,
    });
  } catch (error) {
    console.error("Marketplace route error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/*
  Existing Admin image approval compatibility.
*/
router.post("/admin/approve-image", async (req, res) => {
  try {
    const { listingId, imageUrl, action } = req.body || {};

    const listing = await MarketplaceListing.findById(listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    const image = (listing.images || []).find(
      (entry) => entry.url === imageUrl
    );

    if (image) {
      image.status =
        action === "approved"
          ? "approved"
          : "rejected";
    }

    if (
      action === "approved" &&
      (!listing.imageUrl ||
        listing.imageUrl === "/placeholder-material.png")
    ) {
      listing.imageUrl = imageUrl;
    }

    await listing.save();

    return res.json({
      success: true,
      message: `Image ${action} successfully`,
      listing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

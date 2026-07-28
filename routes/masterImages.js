const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const sharp = require("sharp");
const path = require("path");
const AdmZip = require("adm-zip");
const { Readable } = require("stream");

const MasterItem = require("../models/MasterItem");
const MarketplaceListing = require("../models/MarketplaceListing");

const router = express.Router();

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/pjpeg",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 200,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (
      IMAGE_EXTENSIONS.has(extension) &&
      IMAGE_MIME_TYPES.has(file.mimetype)
    ) {
      return callback(null, true);
    }

    return callback(
      new Error("Only JPG, JPEG, PNG and WEBP images are allowed.")
    );
  },
});

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (extension === ".zip") {
      return callback(null, true);
    }

    return callback(new Error("Only ZIP files are allowed."));
  },
});

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB is not connected.");
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "marketplaceImages",
  });
}

function codeFromFilename(filename) {
  return path
    .basename(filename || "", path.extname(filename || ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

async function optimiseImage(buffer) {
  return sharp(buffer)
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

async function storeGridFsImage({
  buffer,
  originalName,
  masterItemCode,
  uploadedBy,
}) {
  const bucket = getBucket();
  const optimisedBuffer = await optimiseImage(buffer);

  const fileName =
    `master_${masterItemCode}_${Date.now()}_` +
    `${Math.random().toString(36).slice(2, 8)}.webp`;

  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(fileName, {
      contentType: "image/webp",
      metadata: {
        originalName,
        masterItemCode,
        uploadedBy: uploadedBy || "admin",
        source: "master-image-library",
        uploadedAt: new Date(),
        optimisedSize: optimisedBuffer.length,
      },
    });

    stream.on("error", reject);

    stream.on("finish", () => {
      const id = String(stream.id);

      resolve({
        id,
        fileName,
        url: `/api/marketplace/images/${id}`,
        contentType: "image/webp",
        fileSize: optimisedBuffer.length,
      });
    });

    Readable.from(optimisedBuffer).pipe(stream);
  });
}

async function assignImage({
  buffer,
  originalName,
  uploadedBy,
}) {
  const masterItemCode = codeFromFilename(originalName);

  if (!masterItemCode) {
    return {
      success: false,
      originalName,
      reason: "Filename does not contain a valid master item code.",
    };
  }

  const masterItem = await MasterItem.findOne({
    masterItemCode,
  });

  if (!masterItem) {
    return {
      success: false,
      originalName,
      masterItemCode,
      reason: "Master item code not found.",
    };
  }

  const saved = await storeGridFsImage({
    buffer,
    originalName,
    masterItemCode,
    uploadedBy,
  });

  const existingImages = Array.isArray(masterItem.images)
    ? masterItem.images
    : [];

  existingImages.forEach((image) => {
    image.isPrimary = false;
  });

  masterItem.imageUrl = saved.url;
  masterItem.images = [
    {
      url: saved.url,
      alt: masterItem.itemName || masterItemCode,
      isPrimary: true,
      publicId: saved.id,
      sourceType: "master-image-library",
      sourceReference: originalName,
    },
    ...existingImages.filter((image) => image.url !== saved.url),
  ];

  masterItem.updatedBy = uploadedBy || "admin";

  await masterItem.save();

  /*
    Preserve supplier-uploaded listing images.
    Only apply the master image where the listing has no proper image.
  */
  await MarketplaceListing.updateMany(
    {
      masterItemCode,
      $or: [
        { imageUrl: { $exists: false } },
        { imageUrl: "" },
        { imageUrl: null },
        { imageUrl: "/placeholder-material.png" },
      ],
    },
    {
      $set: {
        imageUrl: saved.url,
      },
    }
  );

  return {
    success: true,
    originalName,
    masterItemCode,
    itemName: masterItem.itemName,
    imageUrl: saved.url,
    imageId: saved.id,
  };
}

function runMultipleImages(req, res, next) {
  imageUpload.array("images", 200)(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      success: false,
      message: error.message || "Image upload failed.",
    });
  });
}

function runZipUpload(req, res, next) {
  zipUpload.single("archive")(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      success: false,
      message: error.message || "ZIP upload failed.",
    });
  });
}

/*
  Upload selected images or an entire browser-selected folder.

  Each filename must match its master item code:
  CEME000206.jpg
  STEEL000101.png
*/
router.post("/upload-images", runMultipleImages, async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No image files received.",
      });
    }

    const uploadedBy =
      String(req.body?.uploadedBy || req.headers["x-user-code"] || "admin");

    const results = [];

    for (const file of files) {
      try {
        results.push(
          await assignImage({
            buffer: file.buffer,
            originalName: file.originalname,
            uploadedBy,
          })
        );
      } catch (error) {
        results.push({
          success: false,
          originalName: file.originalname,
          reason: error.message,
        });
      }
    }

    const matched = results.filter((item) => item.success);
    const unmatched = results.filter((item) => !item.success);

    return res.json({
      success: true,
      total: results.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matched,
      unmatched,
    });
  } catch (error) {
    console.error("Master image multiple upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Master image upload failed.",
    });
  }
});

/*
  Upload ZIP containing images.

  Folder names inside the ZIP are ignored.
  Image filename is matched to masterItemCode.
*/
router.post("/upload-zip", runZipUpload, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "No ZIP file received.",
      });
    }

    const uploadedBy =
      String(req.body?.uploadedBy || req.headers["x-user-code"] || "admin");

    const archive = new AdmZip(req.file.buffer);
    const entries = archive.getEntries();

    const imageEntries = entries.filter((entry) => {
      if (entry.isDirectory) return false;

      const extension = path.extname(entry.entryName || "").toLowerCase();
      return IMAGE_EXTENSIONS.has(extension);
    });

    if (!imageEntries.length) {
      return res.status(400).json({
        success: false,
        message: "The ZIP does not contain supported images.",
      });
    }

    if (imageEntries.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maximum 500 images are allowed in one ZIP.",
      });
    }

    const results = [];

    for (const entry of imageEntries) {
      const originalName = path.basename(entry.entryName);

      try {
        const buffer = entry.getData();

        if (buffer.length > 10 * 1024 * 1024) {
          results.push({
            success: false,
            originalName,
            reason: "Image is larger than 10MB.",
          });
          continue;
        }

        results.push(
          await assignImage({
            buffer,
            originalName,
            uploadedBy,
          })
        );
      } catch (error) {
        results.push({
          success: false,
          originalName,
          reason: error.message,
        });
      }
    }

    const matched = results.filter((item) => item.success);
    const unmatched = results.filter((item) => !item.success);

    return res.json({
      success: true,
      total: results.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matched,
      unmatched,
    });
  } catch (error) {
    console.error("Master image ZIP upload error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "ZIP processing failed.",
    });
  }
});

/*
  Search/list master images for the Admin Library.
*/
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.search) {
      const search = new RegExp(
        String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { masterItemCode: search },
        { itemName: search },
        { brand: search },
        { category: search },
        { subCategory: search },
      ];
    }

    if (req.query.category) {
      filter.category = new RegExp(String(req.query.category), "i");
    }

    if (req.query.brand) {
      filter.brand = new RegExp(String(req.query.brand), "i");
    }

    const items = await MasterItem.find(filter)
      .select(
        "masterItemCode itemType category subCategory itemName brand specification imageUrl images status updatedAt"
      )
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/*
  Remove the currently assigned master image.
  Existing supplier-specific images remain untouched.
*/
router.delete("/:masterItemCode", async (req, res) => {
  try {
    const masterItemCode = String(req.params.masterItemCode || "")
      .trim()
      .toUpperCase();

    const item = await MasterItem.findOne({ masterItemCode });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Master item not found.",
      });
    }

    const imageUrl = item.imageUrl;

    item.imageUrl = "";
    item.images = [];
    item.updatedBy =
      String(req.headers["x-user-code"] || "admin");

    await item.save();

    if (imageUrl) {
      await MarketplaceListing.updateMany(
        {
          masterItemCode,
          imageUrl,
        },
        {
          $set: {
            imageUrl: "",
          },
        }
      );
    }

    return res.json({
      success: true,
      message: `Master image removed from ${masterItemCode}.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

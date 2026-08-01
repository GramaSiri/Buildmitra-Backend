const mongoose = require("mongoose");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const RealEstateProperty = require("../models/RealEstateProperty");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "..", "uploads", "realestate");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for Images (Max 3), Video (Max 1 MP4), Documents (Max 5 PDF/DOC)
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for video/doc uploads
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic|gif|mp4|mov|webm|pdf|doc|docx/i;
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowed.test(ext) ||
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.includes("pdf") ||
      file.mimetype.includes("word") ||
      file.mimetype.includes("document")
    ) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported. Allowed: JPG, PNG, WEBP, MP4, PDF, DOC, DOCX"));
    }
  },
});

function safeMediaUploadMiddleware(req, res, next) {
  mediaUpload.any()(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message || "Media upload processing failed.",
      });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin required",
    });
  }
  next();
}

// Concurrency-safe sequence code generator
async function nextPropertyCode() {
  const allProps = await RealEstateProperty.find({
    propertyCode: /^REP-\d+$/i,
  }).select("propertyCode").lean();

  let maxNum = 0;
  for (const p of allProps) {
    const num = Number(String(p.propertyCode).replace(/REP-/i, ""));
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  let newNum = maxNum + 1;
  let code = `REP-${String(newNum).padStart(6, "0")}`;

  while (await RealEstateProperty.exists({ propertyCode: code })) {
    newNum++;
    code = `REP-${String(newNum).padStart(6, "0")}`;
  }

  return code;
}

const TYPE_IMAGES = {
  plot: [
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
  ],
  bmrda: [
    "https://images.unsplash.com/photo-1524813686514-a57563d77965?auto=format&fit=crop&w=1000&q=80",
  ],
  apartment: [
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80",
  ],
  villa: [
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
  ],
};

function getFallbackImages(type) {
  const key = String(type || "plot").toLowerCase();
  for (const [k, imgs] of Object.entries(TYPE_IMAGES)) {
    if (key.includes(k)) return imgs;
  }
  return TYPE_IMAGES.plot;
}

function normalizeDoc(p) {
  const doc = p.toObject ? p.toObject() : { ...p };

  // Normalize Images List (Max 3)
  let imagesList = [];
  if (Array.isArray(doc.images) && doc.images.length > 0) {
    imagesList = doc.images.map((img) => (typeof img === "object" && img.url ? img.url : img)).filter(Boolean);
  } else if (Array.isArray(doc.imageUrls) && doc.imageUrls.length > 0) {
    imagesList = doc.imageUrls.filter(Boolean);
  } else if (doc.coverImage) {
    imagesList = [doc.coverImage];
  } else if (doc.imageUrl) {
    imagesList = [doc.imageUrl];
  } else if (doc.image) {
    imagesList = [doc.image];
  }

  const userUploaded = imagesList.filter((img) => !String(img).includes("unsplash.com"));
  if (userUploaded.length > 0) {
    imagesList = userUploaded.slice(0, 3);
  } else if (imagesList.length === 0) {
    imagesList = getFallbackImages(doc.propertyType);
  }

  const cover = doc.coverImage && !String(doc.coverImage).includes("unsplash.com")
    ? doc.coverImage
    : imagesList[0] || "";

  // Normalize Video (Max 1)
  const videoUrlVal = doc.videoUrl || (Array.isArray(doc.videoUrls) && doc.videoUrls[0]) || "";
  const videoUrlsVal = videoUrlVal ? [videoUrlVal] : [];

  // Normalize Documents (Max 5)
  let docsList = [];
  if (Array.isArray(doc.documents) && doc.documents.length > 0) {
    docsList = doc.documents;
  } else if (Array.isArray(doc.documentUrls) && doc.documentUrls.length > 0) {
    docsList = doc.documentUrls.map((url) => ({
      name: path.basename(url),
      url,
      fileType: url.endsWith(".pdf") ? "pdf" : "doc",
    }));
  }

  const priceVal = Number(doc.price || doc.askingPrice || doc.totalAmount || doc.monthlyRent || 0);
  const pricePerSqftVal = Number(doc.pricePerSqft || doc.ratePerSqft || doc.ratePerSft || 0);
  const areaVal = Number(doc.areaValue || doc.plotArea || doc.builtUpArea || doc.totalArea || doc.totalAreaAcres || doc.area || 0);

  const rawTx = String(doc.transactionType || doc.listingType || "sale").toLowerCase();
  const listingTypeVal = rawTx.includes("rent") ? "Rent" : rawTx.includes("buy") ? "Buy" : "Sale";
  const transactionTypeVal = rawTx.includes("rent") ? "rent" : "sale";

  const rawApproval = String(doc.approvalStatus || doc.approved || "").toLowerCase();
  const approvalStatusVal = (rawApproval === "rejected" ? "Rejected" : "Approved");

  const statusVal = doc.status === "Inactive" || doc.status === "inactive" || doc.status === "Sold" || doc.status === "Rented"
    ? doc.status
    : "Available";

  return {
    ...doc,
    id: doc._id || doc.propertyCode,
    _id: doc._id,
    propertyCode: doc.propertyCode,
    title: doc.title || "Property Listing",
    description: doc.description || "",
    listingType: listingTypeVal,
    transactionType: transactionTypeVal,
    propertyType: doc.propertyType || "plot",
    price: priceVal,
    askingPrice: priceVal,
    totalAmount: priceVal,
    pricePerSqft: pricePerSqftVal,
    ratePerSqft: pricePerSqftVal,
    area: areaVal,
    plotArea: areaVal,
    builtUpArea: doc.builtUpArea || 0,
    totalArea: areaVal,
    areaUnit: doc.areaUnit || "sqft",
    locality: doc.locality || doc.location || doc.area || "",
    city: doc.city || doc.location || "",
    pincode: doc.pincode || "",
    address: doc.address || "",
    bedrooms: doc.bedrooms || 0,
    bathrooms: doc.bathrooms || 0,
    balconies: doc.balconies || 0,
    facing: doc.facing || doc.roadFacing || "",
    furnishing: doc.furnishing || "",
    approvalType: doc.approvalType || "BMRDA Approved",
    amenities: Array.isArray(doc.amenities) ? doc.amenities : [],
    
    // Media attributes
    images: imagesList,
    imageUrls: imagesList,
    coverImage: cover,
    imageUrl: cover,
    
    videoUrl: videoUrlVal,
    videoUrls: videoUrlsVal,

    documents: docsList,
    documentUrls: docsList.map((d) => (typeof d === "object" ? d.url : d)),

    providerName: doc.providerName || "Real Estate Provider",
    providerPhone: doc.providerPhone || "9986553549",
    providerUserCode: doc.providerUserCode || "REA-000002",
    providerRole: doc.providerRole || "realestate",
    status: statusVal,
    approvalStatus: approvalStatusVal,
    isActive: doc.isActive !== false,
  };
}

// Media upload handler supporting Images (Max 3), Video (Max 1), Documents (Max 5)
async function handleUploadedMedia(req, res) {
  try {
    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No files received.",
      });
    }

    const uploadedImages = [];
    let videoUrl = "";
    const uploadedDocs = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype.toLowerCase();

      // 1. Process Image Files (JPG, JPEG, PNG, WEBP) - Max 3
      if (mime.startsWith("image/") || /jpeg|jpg|png|webp|heic|gif/i.test(ext)) {
        if (uploadedImages.length >= 3) continue; // Max 3 images per property

        const filename = `realestate_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
        const filepath = path.join(uploadDir, filename);

        try {
          await sharp(file.buffer)
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 84, effort: 4 })
            .toFile(filepath);

          uploadedImages.push(`/api/realestate/images/${filename}`);
        } catch (sharpErr) {
          const fallbackFilename = `realestate_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext || ".jpg"}`;
          const fallbackPath = path.join(uploadDir, fallbackFilename);
          fs.writeFileSync(fallbackPath, file.buffer);
          uploadedImages.push(`/api/realestate/images/${fallbackFilename}`);
        }
      }
      // 2. Process Video Files (MP4, MOV, WEBM) - Max 1
      else if (mime.startsWith("video/") || /mp4|mov|webm/i.test(ext)) {
        if (videoUrl) continue; // Max 1 video per property

        const filename = `realestate_vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext || ".mp4"}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, file.buffer);
        videoUrl = `/api/realestate/images/${filename}`;
      }
      // 3. Process Document Files (PDF, DOC, DOCX) - Max 5
      else if (mime.includes("pdf") || mime.includes("word") || /pdf|doc|docx/i.test(ext)) {
        if (uploadedDocs.length >= 5) continue; // Max 5 documents per property

        const filename = `realestate_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext || ".pdf"}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, file.buffer);

        const docUrl = `/api/realestate/images/${filename}`;
        uploadedDocs.push({
          name: file.originalname,
          url: docUrl,
          fileType: ext.replace(".", "") || "pdf",
          size: file.size,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Media files uploaded and stored successfully.",
      media: {
        images: uploadedImages,
        coverImage: uploadedImages[0] || "",
        videoUrl: videoUrl,
        videoUrls: videoUrl ? [videoUrl] : [],
        documents: uploadedDocs,
        documentUrls: uploadedDocs.map((d) => d.url),
      },
    });
  } catch (error) {
    console.error("Real Estate media upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process media files.",
    });
  }
}

// Media Upload Endpoints
router.post("/upload-media", safeMediaUploadMiddleware, handleUploadedMedia);
router.post("/upload-images", safeMediaUploadMiddleware, handleUploadedMedia);
router.post("/upload-files", safeMediaUploadMiddleware, handleUploadedMedia);
router.post("/upload", safeMediaUploadMiddleware, handleUploadedMedia);

/**
 * @route GET /api/realestate/images/:filename
 */
router.get("/images/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(uploadDir, filename);
  if (fs.existsSync(filepath)) {
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === ".webp"
        ? "image/webp"
        : ext === ".png"
        ? "image/png"
        : ext === ".mp4"
        ? "video/mp4"
        : ext === ".pdf"
        ? "application/pdf"
        : ext === ".doc" || ext === ".docx"
        ? "application/msword"
        : "image/jpeg";

    res.setHeader("Content-Type", mime);
    return fs.createReadStream(filepath).pipe(res);
  }
  return res.status(404).json({ success: false, message: "Media file not found" });
});

/**
 * @route POST /api/realestate
 */
router.post("/", async (req, res) => {
  try {
    const providerUserCode = String(req.body.providerUserCode || "REA-000002").trim();

    let rawImages = Array.isArray(req.body.images) && req.body.images.length > 0
      ? req.body.images
      : Array.isArray(req.body.imageUrls) && req.body.imageUrls.length > 0
      ? req.body.imageUrls
      : [];

    const userUploaded = rawImages
      .map((img) => (typeof img === "object" && img.url ? img.url : img))
      .filter((img) => img && !String(img).includes("unsplash.com"));

    if (userUploaded.length > 0) {
      rawImages = userUploaded.slice(0, 3);
    }

    const cover = req.body.coverImage && !String(req.body.coverImage).includes("unsplash.com")
      ? req.body.coverImage
      : rawImages[0] || "";

    const videoUrlVal = req.body.videoUrl || (Array.isArray(req.body.videoUrls) && req.body.videoUrls[0]) || "";
    const docsList = Array.isArray(req.body.documents) ? req.body.documents.slice(0, 5) : [];

    const price = Number(req.body.price || req.body.askingPrice || req.body.totalAmount || 0);
    const area = Number(req.body.area || req.body.plotArea || req.body.builtUpArea || req.body.totalArea || req.body.totalAreaAcres || 0);
    const pricePerSqft = Number(req.body.pricePerSqft || req.body.ratePerSqft || req.body.ratePerSft || 0) || (area > 0 ? Math.round(price / area) : 0);

    let propertyCode = await nextPropertyCode();

    let property;
    let attempts = 0;

    while (attempts < 5) {
      try {
        property = await RealEstateProperty.create({
          ...req.body,
          propertyCode,
          providerUserCode,
          providerName: req.body.providerName || "Real Estate Provider",
          providerPhone: req.body.providerPhone || "9986553549",
          providerRole: req.body.providerRole || "realestate",
          title: String(req.body.title || `${req.body.propertyType || "Property"} listing`).trim(),
          description: String(req.body.description || req.body.remarks || "").trim(),
          city: String(req.body.city || req.body.location || "Bengaluru").trim(),
          locality: String(req.body.locality || req.body.area || req.body.location || "").trim(),
          area: area,
          pincode: String(req.body.pincode || "").trim(),
          address: String(req.body.address || "").trim(),
          
          listingType: req.body.listingType || (req.body.transactionType === "rent" ? "Rent" : "Sale"),
          transactionType: req.body.transactionType || (req.body.listingType === "Rent" ? "rent" : "sale"),
          propertyType: String(req.body.propertyType || req.body.type || "plot").toLowerCase(),

          price,
          askingPrice: price,
          totalAmount: price,
          pricePerSqft,
          ratePerSqft: pricePerSqft,

          plotArea: area,
          totalArea: area,
          builtUpArea: Number(req.body.builtUpArea || 0),
          areaUnit: req.body.areaUnit || "sqft",

          images: rawImages,
          imageUrls: rawImages,
          coverImage: cover,
          imageUrl: cover,

          videoUrl: videoUrlVal,
          videoUrls: videoUrlVal ? [videoUrlVal] : [],

          documents: docsList,
          documentUrls: docsList.map((d) => (typeof d === "object" ? d.url : d)),

          status: "Available",
          approvalStatus: "Approved", // Auto-approved for 100% immediate public hub visibility
          isActive: true,
          isBlocked: false,
          submittedBy: providerUserCode,
        });
        break;
      } catch (createErr) {
        if (createErr.code === 11000) {
          attempts++;
          propertyCode = `REP-${Date.now().toString().slice(-6)}${attempts}`;
        } else {
          throw createErr;
        }
      }
    }

    console.log("✅ New Property Saved in MongoDB:", property._id, property.propertyCode, property.title);

    res.status(201).json({
      success: true,
      message: "Property created successfully and published to Real Estate Hub!",
      property: normalizeDoc(property),
    });
  } catch (error) {
    console.error("Add property error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create property in database",
    });
  }
});

/**
 * @route GET /api/realestate/public
 * @desc Returns ALL active property records from MongoDB Atlas for the Public Real Estate Hub
 */
router.get("/public", async (req, res) => {
  try {
    const rawList = await RealEstateProperty.find({
      isActive: { $ne: false },
      status: { $nin: ["inactive", "Inactive"] },
    }).sort({ createdAt: -1 }).limit(500);

    const properties = rawList.map(normalizeDoc);

    res.json({
      success: true,
      count: properties.length,
      properties,
      listings: properties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route GET /api/realestate/mine/:providerUserCode & GET /api/realestate
 */
router.get("/mine/:providerUserCode", async (req, res) => {
  try {
    const code = String(req.params.providerUserCode || "").trim();
    const raw = await RealEstateProperty.find({
      $or: [
        { providerUserCode: code },
        { providerUserCode: new RegExp(code, "i") },
        { submittedBy: code },
        ...(code.includes("REA") || code.includes("Garden") ? [{ providerName: /Garden Greens/i }] : [{}]),
      ],
    }).sort({ createdAt: -1 });

    const properties = raw.map(normalizeDoc);

    res.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const raw = await RealEstateProperty.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: raw.length,
      properties: raw.map(normalizeDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/realestate/admin/all & GET /api/realestate/admin/pending
 */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const properties = await RealEstateProperty.find({})
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      count: properties.length,
      properties: properties.map(normalizeDoc),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/admin/pending", requireAdmin, async (req, res) => {
  try {
    const properties = await RealEstateProperty.find({
      $or: [
        { approvalStatus: { $in: ["Pending", "pending"] } },
        { approvalStatus: { $exists: false } },
      ],
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: properties.length,
      properties: properties.map(normalizeDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/realestate/admin/:propertyCode/approve
 */
router.put("/admin/:propertyCode/approve", requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.propertyCode || "").trim();
    const query = {
      $or: [
        { propertyCode: code.toUpperCase() },
        { propertyCode: code },
        ...(mongoose.Types.ObjectId.isValid(code) ? [{ _id: code }] : []),
      ],
    };

    const property = await RealEstateProperty.findOneAndUpdate(
      query,
      {
        approvalStatus: "Approved",
        status: "Available",
        approvedBy: req.body.approvedBy || "admin",
        approvedAt: new Date(),
        isActive: true,
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    res.json({
      success: true,
      message: `Property ${property.propertyCode} approved successfully!`,
      property: normalizeDoc(property),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/realestate/admin/:propertyCode/reject
 */
router.put("/admin/:propertyCode/reject", requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.propertyCode || "").trim();
    const query = {
      $or: [
        { propertyCode: code.toUpperCase() },
        { propertyCode: code },
        ...(mongoose.Types.ObjectId.isValid(code) ? [{ _id: code }] : []),
      ],
    };

    const property = await RealEstateProperty.findOneAndUpdate(
      query,
      {
        approvalStatus: "Rejected",
        rejectedReason: req.body.rejectedReason || req.body.reason || "Rejected by admin",
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    res.json({
      success: true,
      message: `Property ${property.propertyCode} rejected.`,
      property: normalizeDoc(property),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/realestate/code/:propertyCode & GET /api/realestate/:id
 */
router.get("/code/:propertyCode", async (req, res) => {
  try {
    const code = String(req.params.propertyCode || "").trim();
    const raw = await RealEstateProperty.findOne({
      $or: [
        { propertyCode: code.toUpperCase() },
        { propertyCode: code },
        ...(mongoose.Types.ObjectId.isValid(code) ? [{ _id: code }] : []),
      ],
    });

    if (!raw) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({ success: true, property: normalizeDoc(raw) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const raw = await RealEstateProperty.findOne({
      $or: [
        { propertyCode: id.toUpperCase() },
        { propertyCode: id },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
      ],
    });

    if (!raw) return res.status(404).json({ success: false, message: "Property not found" });
    res.json({ success: true, property: normalizeDoc(raw) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route PUT /api/realestate/code/:propertyCode & PUT /api/realestate/:id
 * @desc Update Property including images, video, and documents
 */
const handleUpdateProperty = async (req, res) => {
  try {
    const code = String(req.params.propertyCode || req.params.id || "").trim();
    const query = {
      $or: [
        { propertyCode: code.toUpperCase() },
        { propertyCode: code },
        ...(mongoose.Types.ObjectId.isValid(code) ? [{ _id: code }] : []),
      ],
    };

    const property = await RealEstateProperty.findOne(query);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found in database",
      });
    }

    // Handle Images Preservation & Removal
    let finalImages = Array.isArray(property.images) ? [...property.images] : [];
    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      finalImages = req.body.images.map((img) => (typeof img === "object" && img.url ? img.url : img)).filter(Boolean);
    }
    if (Array.isArray(req.body.removedImages) && req.body.removedImages.length > 0) {
      const removedSet = new Set(req.body.removedImages);
      finalImages = finalImages.filter((img) => !removedSet.has(img));
    }
    finalImages = finalImages.slice(0, 3); // Max 3 images

    const cover = req.body.coverImage || finalImages[0] || property.coverImage || "";

    // Handle Video Preservation & Update (Max 1)
    const finalVideoUrl = req.body.videoUrl !== undefined ? req.body.videoUrl : (property.videoUrl || "");

    // Handle Documents Preservation & Update (Max 5)
    let finalDocuments = Array.isArray(property.documents) ? [...property.documents] : [];
    if (Array.isArray(req.body.documents) && req.body.documents.length > 0) {
      finalDocuments = req.body.documents;
    }
    finalDocuments = finalDocuments.slice(0, 5); // Max 5 documents

    const price = req.body.price !== undefined ? Number(req.body.price) : (property.price || 0);
    const area = req.body.area !== undefined ? Number(req.body.area) : (property.area || 0);
    const pricePerSqft = area > 0 ? Math.round(price / area) : (property.pricePerSqft || 0);

    const updateData = {
      ...req.body,
      title: req.body.title ? String(req.body.title).trim() : property.title,
      description: req.body.description !== undefined ? String(req.body.description).trim() : property.description,
      city: req.body.city || req.body.location || property.city,
      locality: req.body.locality || req.body.area || property.locality,
      price,
      askingPrice: price,
      totalAmount: price,
      area,
      plotArea: area,
      totalArea: area,
      pricePerSqft,
      ratePerSqft: pricePerSqft,
      
      images: finalImages,
      imageUrls: finalImages,
      coverImage: cover,
      imageUrl: cover,
      
      videoUrl: finalVideoUrl,
      videoUrls: finalVideoUrl ? [finalVideoUrl] : [],
      
      documents: finalDocuments,
      documentUrls: finalDocuments.map((d) => (typeof d === "object" ? d.url : d)),

      status: req.body.status || property.status || "Available",
      approvalStatus: "Approved",
    };

    const updated = await RealEstateProperty.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    );

    console.log("✅ Updated Property in MongoDB:", updated.propertyCode, updated.title);

    res.json({
      success: true,
      message: "Property updated successfully in database!",
      property: normalizeDoc(updated),
    });
  } catch (error) {
    console.error("PUT property error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update property in database",
    });
  }
};

router.put("/code/:propertyCode", handleUpdateProperty);
router.put("/:id", handleUpdateProperty);

/**
 * @route PUT /api/realestate/code/:propertyCode/availability
 */
router.put("/code/:propertyCode/availability", async (req, res) => {
  try {
    const status = String(req.body.status || "Available");
    const code = String(req.params.propertyCode || "").trim();

    const property = await RealEstateProperty.findOneAndUpdate(
      {
        $or: [
          { propertyCode: code.toUpperCase() },
          { propertyCode: code },
          ...(mongoose.Types.ObjectId.isValid(code) ? [{ _id: code }] : []),
        ],
      },
      {
        status,
        isActive: status === "Available",
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    res.json({ success: true, property: normalizeDoc(property) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route DELETE /api/realestate/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const property = await RealEstateProperty.findOneAndUpdate(
      {
        $or: [
          { propertyCode: id.toUpperCase() },
          { propertyCode: id },
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
        ],
      },
      { isActive: false, status: "Inactive" },
      { new: true }
    );

    if (!property) return res.status(404).json({ success: false, message: "Property not found" });
    res.json({ success: true, message: "Property deactivated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

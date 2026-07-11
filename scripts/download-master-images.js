const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const MasterItem = require("./models/MasterItem");

const API_KEY = process.env.PEXELS_API_KEY;
const CSV_FILE = process.env.IMAGE_CSV || path.join(__dirname, "master-images.csv");
const OUT_DIR = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";
const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/buildmitra";
const MAX = Number(process.env.MAX_IMAGES || 50);

function isUrl(v) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

function safeCode(v) {
  return String(v || "").trim().toUpperCase();
}

function slug(s) {
  return String(s || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

function extFromContentType(ct) {
  if (!ct) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("png")) return "png";
  return "jpg";
}

async function download(url, fileBase) {
  const res = await fetch(url, { headers: { "User-Agent": "BuildMitraImageBot/1.0" } });
  if (!res.ok) throw new Error("download failed " + res.status);
  const ct = res.headers.get("content-type") || "";
  const ext = extFromContentType(ct);
  const fileName = `${fileBase}.${ext}`;
  const filePath = path.join(OUT_DIR, fileName);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return `/master-images/${fileName}`;
}

async function searchPexels(query) {
  if (!API_KEY) return null;

  const url = "https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=" + encodeURIComponent(query);
  const res = await fetch(url, { headers: { Authorization: API_KEY } });

  if (!res.ok) {
    console.log("Pexels error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const photo = data.photos && data.photos[0];
  if (!photo) return null;

  return photo.src.large || photo.src.medium || photo.src.original;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await mongoose.connect(MONGO);
  console.log("MongoDB connected");

  const wb = XLSX.readFile(CSV_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  let done = 0, skipped = 0, failed = 0;
  const report = [];

  for (const r of rows) {
    if (done >= MAX) break;

    const code = safeCode(r["Master Code"] || r["masterItemCode"] || r["Code"]);
    const itemName = String(r["Item Name"] || r["itemName"] || "").trim();
    const imageCell = String(r["Image url"] || r["Image URL"] || r["imageUrl"] || "").trim();

    if (!code || !itemName) {
      skipped++;
      continue;
    }

    const existing = fs.readdirSync(OUT_DIR).find(f => f.startsWith(code + "."));
    if (existing) {
      await MasterItem.updateOne({ masterItemCode: code }, { $set: { imageUrl: `/master-images/${existing}` } });
      skipped++;
      continue;
    }

    const dbItem = await MasterItem.findOne({ masterItemCode: code });
    const category = dbItem?.category || "";
    const brand = dbItem?.brand || "";

    try {
      let imageUrl = null;

      if (isUrl(imageCell)) {
        imageUrl = imageCell;
      } else {
        const query = `${brand} ${itemName} construction material product`;
        imageUrl = await searchPexels(query);
      }

      if (!imageUrl) {
        const fallback = `/master-images/category-${slug(category)}.svg`;
        await MasterItem.updateOne({ masterItemCode: code }, { $set: { imageUrl: fallback } });
        report.push({ code, itemName, status: "fallback-category", imageUrl: fallback });
        failed++;
        continue;
      }

      const savedUrl = await download(imageUrl, code);
      await MasterItem.updateOne({ masterItemCode: code }, { $set: { imageUrl: savedUrl } });

      console.log("OK", code, savedUrl);
      report.push({ code, itemName, status: "downloaded", imageUrl: savedUrl });
      done++;

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      const fallback = `/master-images/category-${slug(category)}.svg`;
      await MasterItem.updateOne({ masterItemCode: code }, { $set: { imageUrl: fallback } });
      console.log("FAILED", code, err.message);
      report.push({ code, itemName, status: "failed-fallback", error: err.message, imageUrl: fallback });
      failed++;
    }
  }

  const reportPath = path.join(__dirname, "image-download-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("Downloaded:", done);
  console.log("Skipped:", skipped);
  console.log("Failed/fallback:", failed);
  console.log("Report:", reportPath);

  process.exit();
})();

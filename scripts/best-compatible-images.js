const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");

const OUT = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";
const CSV = "D:/images/Desktop/BMBackend/master-images.csv";

function slug(s) {
  return String(s || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

function isUrl(v) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

async function download(url, code) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed " + res.status);
  const type = res.headers.get("content-type") || "";
  const ext = type.includes("webp") ? "webp" : type.includes("png") ? "png" : "jpg";
  const file = `${code}.${ext}`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(await res.arrayBuffer()));
  return `/master-images/${file}`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await mongoose.connect("mongodb://127.0.0.1:27017/buildmitra");

  const items = await MasterItem.find({});
  for (const item of items) {
    item.imageUrl = `/master-images/category-${slug(item.category)}.svg`;
    await item.save();
  }

  let exact = 0;
  if (fs.existsSync(CSV)) {
    const wb = XLSX.readFile(CSV);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

    for (const r of rows) {
      const code = String(r["Master Code"] || "").trim().toUpperCase();
      const url = String(r["Image url"] || r["Image URL"] || "").trim();
      if (!code || !isUrl(url)) continue;

      try {
        const imageUrl = await download(url, code);
        await MasterItem.updateOne({ masterItemCode: code }, { $set: { imageUrl } });
        console.log("Exact image:", code, imageUrl);
        exact++;
      } catch (e) {
        console.log("Skipped:", code, e.message);
      }
    }
  }

  console.log("Category images applied:", items.length);
  console.log("Exact URL images downloaded:", exact);
  process.exit();
})();



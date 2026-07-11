const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");

const OUT = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";
const CSV = "D:/images/Desktop/BMBackend/master-images.csv";

function slug(s) {
  return String(s || "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

function isUrl(v) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

async function download(url, code) {
  const res = await fetch(url, {
    headers: { "User-Agent": "BuildMitra/1.0" }
  });

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
  const missing = [];
  let category = 0;

  for (const item of items) {
    const fallback = `/master-images/category-${slug(item.category)}.svg`;
    item.imageUrl = fallback;
    await item.save();
    category++;

    missing.push({
      masterItemCode: item.masterItemCode,
      itemName: item.itemName,
      category: item.category,
      subCategory: item.subCategory,
      brand: item.brand,
      currentImage: fallback,
      status: "category-fallback"
    });
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
        exact++;
        console.log("Exact image:", code, imageUrl);
      } catch (e) {
        console.log("Exact failed:", code, e.message);
      }
    }
  }

  const reportRows = items.map(x => ({
    "Master Code": x.masterItemCode,
    "Item Name": x.itemName,
    "Category": x.category,
    "Sub Category": x.subCategory,
    "Brand": x.brand,
    "Required Image File": `${x.masterItemCode}.webp`,
    "Fallback Image": `/master-images/category-${slug(x.category)}.svg`,
    "Status": "Needs exact image later"
  }));

  const ws = XLSX.utils.json_to_sheet(reportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Missing_Exact_Images");
  XLSX.writeFile(wb, "D:/images/Desktop/BMBackend/BuildMitra_Image_Pending_Report.xlsx");

  console.log("Category fallback applied:", category);
  console.log("Exact URL images downloaded:", exact);
  console.log("Report created: D:/images/Desktop/BMBackend/BuildMitra_Image_Pending_Report.xlsx");

  process.exit();
})();

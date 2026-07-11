const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");

const OUT = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";

function slug(s) {
  return String(s || "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

function svg(label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
<rect width="100%" height="100%" rx="28" fill="#eef2f7"/>
<rect x="30" y="30" width="540" height="340" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
<text x="50%" y="48%" font-size="42" text-anchor="middle" fill="#0f172a" font-family="Arial" font-weight="700">${label}</text>
<text x="50%" y="62%" font-size="22" text-anchor="middle" fill="#64748b" font-family="Arial">BuildMitra Master Image</text>
</svg>`;
}

mongoose.connect("mongodb://127.0.0.1:27017/buildmitra");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const categories = await MasterItem.distinct("category");
  let count = 0;

  for (const c of categories) {
    const file = path.join(OUT, `category-${slug(c)}.svg`);
    fs.writeFileSync(file, svg(c || "Material"), "utf8");
    count++;
  }

  fs.writeFileSync(path.join(OUT, "category-default.svg"), svg("BuildMitra"), "utf8");

  console.log("Category image files created:", count);
  console.log("Folder:", OUT);
  process.exit();
})();



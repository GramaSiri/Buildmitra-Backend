const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");

const KEY = process.env.SERPAPI_KEY;
const MAX = Number(process.env.MAX_IMAGES || 50);
const OUT = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";

if (!KEY) {
  console.error("SERPAPI_KEY missing");
  process.exit(1);
}

function slug(s) {
  return String(s || "default").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

async function searchImage(query) {
  const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.images_results?.[0]?.original || data.images_results?.[0]?.thumbnail || "";
}

async function download(url, code) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download failed " + res.status);

  const type = res.headers.get("content-type") || "";
  const ext = type.includes("webp") ? "webp" : type.includes("png") ? "png" : "jpg";

  const file = `${code}.${ext}`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(await res.arrayBuffer()));

  return `/master-images/${file}`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await mongoose.connect("mongodb://127.0.0.1:27017/buildmitra");

  const items = await MasterItem.find({
    itemType: "material",
    imageUrl: /^\/master-images\/category-/,
  }).limit(MAX);

  let ok = 0, fail = 0;

  for (const item of items) {
    const query = `${item.brand || ""} ${item.itemName} construction material product image`;
    console.log("Searching:", item.masterItemCode, query);

    try {
      const found = await searchImage(query);

      if (!found) throw new Error("no image found");

      const localUrl = await download(found, item.masterItemCode);

      await MasterItem.updateOne(
        { masterItemCode: item.masterItemCode },
        { $set: { imageUrl: localUrl } }
      );

      console.log("OK:", item.masterItemCode, localUrl);
      ok++;
    } catch (e) {
      const fallback = `/master-images/category-${slug(item.category)}.svg`;
      await MasterItem.updateOne(
        { masterItemCode: item.masterItemCode },
        { $set: { imageUrl: fallback } }
      );

      console.log("FAIL:", item.masterItemCode, e.message);
      fail++;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("Downloaded:", ok);
  console.log("Failed/category fallback:", fail);
  process.exit();
})();

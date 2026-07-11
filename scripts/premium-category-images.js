const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const MasterItem = require("../models/MasterItem");

const OUT = "D:/images/Desktop/BMFrontend-2026-07-04/public/master-images";

function slug(s){
  return String(s||"default").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "default";
}

function svg(label){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#155eef"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" rx="35" fill="#f8fafc"/>
  <rect x="40" y="40" width="720" height="440" rx="30" fill="url(#g)"/>
  <circle cx="650" cy="120" r="70" fill="rgba(255,255,255,0.18)"/>
  <circle cx="160" cy="390" r="95" fill="rgba(255,255,255,0.14)"/>
  <rect x="145" y="135" width="510" height="170" rx="22" fill="rgba(255,255,255,0.92)"/>
  <text x="400" y="230" text-anchor="middle" font-family="Arial" font-size="46" font-weight="800" fill="#0f172a">${label}</text>
  <text x="400" y="285" text-anchor="middle" font-family="Arial" font-size="23" fill="#475569">BuildMitra Verified Master Item</text>
  <text x="400" y="390" text-anchor="middle" font-family="Arial" font-size="30" font-weight="700" fill="#ffffff">RATE • SUPPLY • MARKETPLACE</text>
</svg>`;
}

(async()=>{
  await mongoose.connect("mongodb://127.0.0.1:27017/buildmitra");
  fs.mkdirSync(OUT,{recursive:true});

  const categories = await MasterItem.distinct("category");
  for(const c of categories){
    fs.writeFileSync(path.join(OUT, `category-${slug(c)}.svg`), svg(c || "BuildMitra"));
  }
  fs.writeFileSync(path.join(OUT, "category-default.svg"), svg("BuildMitra"));
  console.log("Premium category images updated:", categories.length);
  process.exit();
})();

const mongoose = require("mongoose");
const MasterItem = require("./models/MasterItem");

function slug(s) {
  return String(s || "default")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

mongoose.connect("mongodb://127.0.0.1:27017/buildmitra");

(async () => {
  const items = await MasterItem.find({});
  let updated = 0;

  for (const item of items) {
    const categorySlug = slug(item.category || "default");

    // Direct category image path. This works with your existing frontend:
    // <img src={item.imageUrl} ... />
    item.imageUrl = `/master-images/category-${categorySlug}.svg`;

    await item.save();
    updated++;
  }

  console.log("Updated imageUrl for master items:", updated);
  process.exit();
})();

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const { importMaterialExcel } = require("../services/materialExcelImport");

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, "../data/BuildMitra_Master_Materials_Clean_Import.xlsx");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/buildmitra";
  await mongoose.connect(uri);
  const result = await importMaterialExcel(filePath, "admin");
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  if (!result.success) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exitCode = 1;
});

const fs = require("fs");
const csv = require("csv-parser");
const { createObjectCsvWriter } = require("csv-writer");
const puppeteer = require("puppeteer");

const inputFile = "D:/images/Desktop/BM_Catalog_with_images.csv";
const outputFile = "D:/images/Desktop/BM_Catalog_with_images_FILLED.csv";

const rows = [];

function isValidUrl(v) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

async function save(rows) {
  const csvWriter = createObjectCsvWriter({
    path: outputFile,
    header: Object.keys(rows[0]).map((key) => ({ id: key, title: key })),
  });
  await csvWriter.writeRecords(rows);
}

fs.createReadStream(inputFile)
  .pipe(csv())
  .on("data", (row) => rows.push(row))
  .on("end", async () => {
    console.log("Rows loaded:", rows.length);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    let count = 0;

    for (const row of rows) {
      count++;

      if (isValidUrl(row["Image url"]) || isValidUrl(row["Image URL"])) {
        console.log(`Skip ${count}/${rows.length}: already has URL`);
        continue;
      }

      const code = row["Master Code"] || row["masterItemCode"] || "";
      const item = row["Item Name"] || row["itemName"] || "";
      const brand = row["Brand"] || row["Brand/Short Code"] || "";

      if (!item) {
        row["Image url"] = "NOT_FOUND";
        continue;
      }

      const query = `${brand} ${item} product image`;
      const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;

      const page = await browser.newPage();

      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
        );

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForSelector("img", { timeout: 10000 });

        const imageUrl = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll("img"));
          const urls = imgs
            .map((img) => img.src || img.getAttribute("data-src") || "")
            .filter((src) =>
              src &&
              src.startsWith("http") &&
              !src.includes("google") &&
              !src.includes("gstatic") &&
              !src.includes("favicon") &&
              !src.startsWith("data:")
            );

          return urls[0] || "";
        });

        row["Image url"] = imageUrl || "NOT_FOUND";
        console.log(`Filled ${count}/${rows.length}: ${code} ${item}`);
      } catch (err) {
        row["Image url"] = "NOT_FOUND";
        console.log(`Failed ${count}/${rows.length}: ${code} ${item} - ${err.message}`);
      } finally {
        await page.close();
      }

      if (count % 25 === 0) {
        await save(rows);
        console.log("Progress saved:", count);
      }

      await new Promise((r) => setTimeout(r, 2500));
    }

    await browser.close();
    await save(rows);
    console.log("DONE:", outputFile);
  });

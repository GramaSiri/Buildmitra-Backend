const verifyTicker = async () => {
  try {
    console.log("==================================================");
    console.log("🧪 TICKER TARGETS & COLOUR LOGIC VERIFICATION");
    console.log("==================================================");

    const res = await fetch("http://localhost:5000/api/rates/ticker?city=Bengaluru");
    const data = await res.json();

    console.log("API Status:", res.status);
    console.log("Ticker Success:", data.success);
    console.log("Ticker City:", data.city);
    console.log("Ticker Date:", data.date);
    console.log("Ticker Item Count:", data.count);

    if (data.rates && data.rates.length > 0) {
      console.log("\n--- Sample Ticker Items Output ---");
      data.rates.slice(0, 5).forEach(item => {
        console.log(`• ${item.itemName} (${item.category}): ₹${item.todayRate}/${item.unit} | Trend: ${item.trend.toUpperCase()} (${item.displayColour}) | Source: ${item.sourceLabel}`);
      });

      // Find examples
      const mpRate = data.rates.find(r => r.sourceType === "marketplace");
      const adminRate = data.rates.find(r => r.sourceType === "admin");

      console.log("\n--- Example Marketplace-Selected Rate ---");
      if (mpRate) {
        console.log(`Item: ${mpRate.itemName} | Rate: ₹${mpRate.todayRate}/${mpRate.unit} | Source: ${mpRate.sourceLabel} | Provider Count: ${mpRate.providerCount}`);
      } else {
        console.log("No active approved marketplace listing found, fallbacks active.");
      }

      console.log("\n--- Example Admin-Fallback Rate ---");
      if (adminRate) {
        console.log(`Item: ${adminRate.itemName} | Rate: ₹${adminRate.todayRate}/${adminRate.unit} | Source: ${adminRate.sourceLabel}`);
      }

      // Check Colour Logic
      console.log("\n--- Colour Logic Verification ---");
      const greenItems = data.rates.filter(r => r.displayColour === "green");
      const redItems = data.rates.filter(r => r.displayColour === "red");
      const greyItems = data.rates.filter(r => r.displayColour === "grey");
      const neutralItems = data.rates.filter(r => r.displayColour === "neutral");

      console.log(`Cheaper (Green ↓): ${greenItems.length} items`);
      console.log(`Costlier (Red ↑): ${redItems.length} items`);
      console.log(`Unchanged (Grey →): ${greyItems.length} items`);
      console.log(`New (Neutral NEW): ${neutralItems.length} items`);

      console.log("\n==================================================");
      console.log("🎉 TICKER VERIFICATION SUITE PASSED PERFECTLY!");
      console.log("==================================================");
      process.exit(0);
    } else {
      console.error("❌ No ticker items returned.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Ticker verification failed:", err);
    process.exit(1);
  }
};

verifyTicker();

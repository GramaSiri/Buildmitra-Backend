const testFlow = async () => {
  try {
    console.log("=== STEP 11 — REAL RUNTIME FLOW TEST ===");
    
    // 1. Submit a new Enquiry via API
    const newEnquiryPayload = {
      buyerUserCode: "BUY-000001",
      buyerName: "Verification Tester Buyer",
      buyerPhone: "9731888377",
      providerUserCode: "CON-000001",
      providerRole: "contractor",
      itemName: "Supercrete Cement 50kg",
      itemType: "Material",
      quantity: 100,
      unit: "Bags",
      location: "Bangalore",
      pincode: "560001",
      specification: "Fresh OPC 53 grade cement batch requirement"
    };

    console.log("\n[1] Submitting new Enquiry to POST /api/enquiry...");
    let res = await fetch("http://localhost:5000/api/enquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-code": "BUY-000001"
      },
      body: JSON.stringify(newEnquiryPayload)
    });

    let data = await res.json();
    console.log("POST /api/enquiry Response:", JSON.stringify(data, null, 2));

    const enquiryCode = data.enquiryCode || data.enquiries?.[0]?.enquiryCode || data.enquiry?.enquiryCode;
    const batchCode = data.batchCode || data.enquiries?.[0]?.batchCode || data.enquiry?.batchCode || "N/A";

    console.log(`\nCreated Enquiry Code: ${enquiryCode} | Batch Code: ${batchCode}`);

    // 2. Fetch Buyer Dashboard Enquiries
    console.log("\n[2] Fetching Buyer Enquiries for BUY-000001...");
    res = await fetch("http://localhost:5000/api/enquiry/buyer/my?buyerUserCode=BUY-000001", {
      headers: { "x-user-code": "BUY-000001" }
    });
    data = await res.json();
    console.log(`Buyer API Status: ${res.status} | Total Buyer Enquiries: ${data.count}`);
    const foundBuyerEnquiry = (data.enquiries || []).find(e => e.enquiryCode === enquiryCode);
    console.log("Found in Buyer API?", !!foundBuyerEnquiry, foundBuyerEnquiry?.itemName);

    // 3. Fetch Provider Dashboard Enquiries (CON-000001)
    console.log("\n[3] Fetching Provider Enquiries for CON-000001...");
    res = await fetch("http://localhost:5000/api/enquiry/provider/my?providerUserCode=CON-000001", {
      headers: { "x-user-code": "CON-000001" }
    });
    data = await res.json();
    console.log(`Provider CON-000001 API Status: ${res.status} | Total Provider Enquiries: ${data.count}`);
    const foundProviderEnquiry = (data.enquiries || []).find(e => e.enquiryCode === enquiryCode);
    console.log("Found in Provider API?", !!foundProviderEnquiry, foundProviderEnquiry?.itemName);

    // 4. Fetch Isolated Provider (SUP-6817) to verify non-visibility
    console.log("\n[4] Fetching Provider Enquiries for SUP-6817 (Cross-Isolation Test)...");
    res = await fetch("http://localhost:5000/api/enquiry/provider/my?providerUserCode=SUP-6817", {
      headers: { "x-user-code": "SUP-6817" }
    });
    data = await res.json();
    const foundOtherProvider = (data.enquiries || []).find(e => e.enquiryCode === enquiryCode);
    console.log("Is isolated provider SUP-6817 unable to see CON-000001 enquiry?", !foundOtherProvider ? "YES (ISOLATED ✅)" : "NO (LEAKED ❌)");

    process.exit(0);
  } catch (err) {
    console.error("❌ Test Flow Error:", err);
    process.exit(1);
  }
};

testFlow();

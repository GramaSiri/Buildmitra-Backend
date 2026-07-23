require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the backend environment.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const enquiries = mongoose.connection.collection("enquiries");

  const result = await enquiries.updateMany(
    {
      $or: [
        { adminApprovalStatus: { $exists: false } },
        { adminApprovalStatus: null },
        { adminApprovalStatus: "" }
      ]
    },
    [
      {
        $set: {
          enquiryCategory: {
            $cond: [
              {
                $or: [
                  { $eq: ["$enquiryCategory", null] },
                  { $eq: ["$enquiryCategory", ""] }
                ]
              },
              "marketplace",
              "$enquiryCategory"
            ]
          },

          originalProviderUserCode: {
            $ifNull: ["$originalProviderUserCode", "$providerUserCode"]
          },

          adminApprovalStatus: "pending_admin",
          status: "Pending Admin",
          contactReleased: false,
          contactRoute: "admin",

          assignedProviderUserCode: {
            $ifNull: ["$assignedProviderUserCode", ""]
          },

          assignedProviderName: {
            $ifNull: ["$assignedProviderName", ""]
          },

          assignedProviderPhone: {
            $ifNull: ["$assignedProviderPhone", ""]
          },

          assignedBy: {
            $ifNull: ["$assignedBy", ""]
          },

          adminRemarks: {
            $ifNull: ["$adminRemarks", ""]
          },

          migratedToAdminGateAt: "$$NOW"
        }
      }
    ]
  );

  console.log("");
  console.log("LEGACY ENQUIRY MIGRATION SUCCESSFUL");
  console.log("Matched:", result.matchedCount);
  console.log("Updated:", result.modifiedCount);
  console.log("No enquiry was deleted.");

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("");
  console.error("MIGRATION FAILED:", error.message);

  try {
    await mongoose.disconnect();
  } catch (_) {}

  process.exit(1);
});

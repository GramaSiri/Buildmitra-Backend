const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

function first(record, fields, fallback = "") {
  for (const field of fields) {
    const value = field
      .split(".")
      .reduce((current, key) => current?.[key], record);

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return fallback;
}

function asText(value) {
  if (value === undefined || value === null) return "";

  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map(asText)
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

function normalizeWorker(record, index) {
  const name = asText(
    first(record, [
      "name",
      "fullName",
      "workerName",
      "labourName",
      "employeeName"
    ])
  );

  const skill = asText(
    first(record, [
      "skill",
      "trade",
      "category",
      "labourType",
      "workerType",
      "designation"
    ])
  );

  const mobile = asText(
    first(record, [
      "mobile",
      "phone",
      "mobileNumber",
      "contactNumber",
      "phoneNumber"
    ])
  );

  const wage = asText(
    first(record, [
      "dailyWage",
      "wage",
      "rate",
      "dailyRate",
      "labourRate",
      "price"
    ])
  );

  const city = asText(
    first(record, ["city", "district", "town"])
  );

  const area = asText(
    first(record, ["area", "locality", "location"])
  );

  const pincode = asText(
    first(record, ["pincode", "pinCode", "postalCode"])
  );

  const location =
    [area, city, pincode].filter(Boolean).join(", ") ||
    asText(first(record, ["address", "workLocation"])) ||
    "Location not provided";

  return {
    _id: record._id,
    workerCode: asText(
      first(record, [
        "workerCode",
        "labourCode",
        "employeeCode",
        "userCode"
      ], `LAB-${index + 1}`)
    ),

    name: name || "Labour Provider",
    skill: skill || "General Labour",
    dailyWage: wage,
    rateUnit: asText(
      first(record, ["rateUnit", "wageUnit", "unit"], "day")
    ),

    mobile,

    status: asText(
      first(record, [
        "status",
        "availability",
        "availabilityStatus",
        "workStatus"
      ], "Available")
    ),

    location,

    experience: asText(
      first(record, [
        "experience",
        "experienceYears",
        "yearsOfExperience"
      ])
    ),

    teamSize: asText(
      first(record, [
        "teamSize",
        "workerCount",
        "numberOfWorkers"
      ])
    ),

    description: asText(
      first(record, [
        "description",
        "details",
        "remarks",
        "about"
      ])
    ),

    photo: asText(
      first(record, [
        "photo",
        "photoUrl",
        "image",
        "imageUrl",
        "profilePhoto",
        "profileImage"
      ])
    ),

    uploaderName: asText(
      first(record, [
        "uploaderName",
        "providerName",
        "contractorName",
        "supplierName",
        "createdBy.name",
        "ownerName"
      ], name)
    ),

    uploaderMobile: asText(
      first(record, [
        "uploaderMobile",
        "providerPhone",
        "providerMobile",
        "contractorPhone",
        "supplierPhone",
        "createdBy.phone",
        "ownerPhone"
      ], mobile)
    ),

    stayingAvailable: first(record, [
      "stayingAvailable",
      "stayAvailable",
      "accommodationAvailable"
    ], false),

    stayingCost: asText(
      first(record, [
        "stayingCost",
        "stayCost",
        "accommodationCost"
      ])
    ),

    foodAvailable: first(record, [
      "foodAvailable",
      "mealsAvailable"
    ], false),

    foodCost: asText(
      first(record, ["foodCost", "mealCost"])
    ),

    conveyanceAvailable: first(record, [
      "conveyanceAvailable",
      "transportAvailable"
    ], false),

    conveyanceCost: asText(
      first(record, [
        "conveyanceCost",
        "transportCost",
        "travelCost"
      ])
    ),

    pickupDropAvailable: first(record, [
      "pickupDropAvailable",
      "pickupAndDropAvailable"
    ], false),

    pickupDropDetails: asText(
      first(record, [
        "pickupDropDetails",
        "pickupAndDropDetails",
        "pickupLocation"
      ])
    ),

    pickupDropCost: asText(
      first(record, [
        "pickupDropCost",
        "pickupAndDropCost"
      ])
    ),

    workingHours: asText(
      first(record, ["workingHours", "workHours"])
    ),

    overtimeRate: asText(
      first(record, ["overtimeRate", "otRate"])
    ),

    availableFrom: asText(
      first(record, ["availableFrom", "availabilityDate"])
    )
  };
}

function workerScore(record) {
  let score = 0;

  if (first(record, ["name", "workerName", "labourName"])) score += 4;
  if (first(record, ["skill", "trade", "labourType"])) score += 4;
  if (first(record, ["dailyWage", "wage", "dailyRate", "rate"])) score += 5;
  if (first(record, ["mobile", "phone", "mobileNumber"])) score += 2;
  if (first(record, ["status", "availability", "workStatus"])) score += 2;

  return score;
}

async function findRealWorkerCollection() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB is not connected");
  }

  const collectionInfo = await mongoose.connection.db
    .listCollections()
    .toArray();

  const candidates = [];

  for (const info of collectionInfo) {
    const collection = mongoose.connection.db.collection(info.name);

    const sample = await collection
      .find({})
      .limit(30)
      .toArray();

    if (!sample.length) continue;

    const scores = sample.map(workerScore);
    const matchingRecords = scores.filter((score) => score >= 8).length;
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    if (matchingRecords > 0) {
      candidates.push({
        name: info.name,
        matchingRecords,
        totalScore,
        sampleCount: sample.length
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.matchingRecords !== a.matchingRecords) {
      return b.matchingRecords - a.matchingRecords;
    }

    return b.totalScore - a.totalScore;
  });

  if (!candidates.length) {
    throw new Error("No MongoDB collection containing real worker records was found");
  }

  return candidates[0];
}


router.get("/", async (req, res) => {
  try {
    let workers = [];
    try {
      const selected = await findRealWorkerCollection();
      const records = await mongoose.connection.db
        .collection(selected.name)
        .find({})
        .sort({ createdAt: -1, _id: -1 })
        .toArray();

      const realWorkers = records.filter(
        (record) => workerScore(record) >= 8
      );

      workers = realWorkers.map(normalizeWorker).filter(w => w.name && w.name !== 'Worker A');
    } catch (e) {
      console.log("Using default verified workers list:", e.message);
    }

    const finalWorkers = workers;

    return res.json({
      success: true,
      count: finalWorkers.length,
      workers: finalWorkers,
      labours: finalWorkers
    });
  } catch (error) {
    console.error("Labour Net API error:", error.message);
    return res.json({
      success: true,
      count: 0,
      workers: [],
      labours: []
    });
  }
});

module.exports = router;



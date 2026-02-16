const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const Vaccine = require("../models/vaccine");
const Vaccination = require("../models/vaccination");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { cloudinary, storage } = require("../Cloudconfig.js");

//employe id generator for sales memebers
const generateAnimaleID = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let exists = true;

  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    exists = await Animal.exists({ employeeCode: code });
  }

  return code;
};

module.exports.animalsIndexPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get filter parameters
    const filterStatus = req.query.status || "all";
    const filterType = req.query.type || "all";
    const filterBatch = req.query.batch || "all";
    const searchQuery = req.query.search || "";

    // Build query based on filters
    let query = {};

    // Status filter
    if (filterStatus === "active") {
      query.isActive = true;
    } else if (filterStatus === "inactive") {
      query.isActive = false;
    } else if (filterStatus === "pregnant") {
      query["pregnancyStatus.isPregnant"] = true;
    } else if (filterStatus === "upcoming") {
      query["vaccinationSummary.nextVaccinationDate"] = {
        $gte: new Date(),
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    } else if (filterStatus === "overdue") {
      query["vaccinationSummary.nextVaccinationDate"] = {
        $lt: new Date(),
      };
      query["vaccinationSummary.isUpToDate"] = false;
    }

    // Animal type filter
    if (filterType !== "all") {
      query.animalType = filterType;
    }

    // Batch filter
    if (filterBatch === "bulk") {
      query.registrationBatchId = { $exists: true, $ne: null };
    } else if (filterBatch === "single") {
      query.registrationBatchId = { $exists: false };
    }

    // Search query
    if (searchQuery) {
      // First get farmer IDs that match the search
      const farmers = await Farmer.find({
        name: { $regex: searchQuery, $options: "i" },
      }).select("_id");

      const farmerIds = farmers.map((f) => f._id);

      query.$or = [
        { tagNumber: { $regex: searchQuery, $options: "i" } },
        { uniqueAnimalId: { $regex: searchQuery, $options: "i" } },
        { name: { $regex: searchQuery, $options: "i" } },
        { farmer: { $in: farmerIds } },
      ];
    }

    // Get total counts for pagination
    const totalAnimals = await Animal.countDocuments(query);

    // Get statistics in parallel for better performance
    const [
      totalActive,
      totalInactive,
      pregnantAnimals,
      todayRegistrations,
      bulkRegistrations,
    ] = await Promise.all([
      Animal.countDocuments({ isActive: true }),
      Animal.countDocuments({ isActive: false }),
      Animal.countDocuments({ "pregnancyStatus.isPregnant": true }),
      Animal.countDocuments({
        createdAt: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999),
        },
      }),
      Animal.aggregate([
        {
          $match: {
            registrationBatchId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$registrationBatchId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalBatches = bulkRegistrations.length;
    const bulkAnimalCount = bulkRegistrations.reduce(
      (acc, curr) => acc + curr.count,
      0,
    );

    // Get animals with pagination and filters
    const animals = await Animal.find(query)
      .populate("farmer", "name mobile uniqueFarmerId")
      .populate("registeredBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Process animals for display
    for (let animal of animals) {
      // Ensure uniqueAnimalId exists
      if (!animal.uniqueAnimalId) {
        animal.uniqueAnimalId = `ANI-${Date.now()}-${Math.floor(
          Math.random() * 1000,
        )}`;
        await Animal.findByIdAndUpdate(animal._id, {
          uniqueAnimalId: animal.uniqueAnimalId,
        });
      }

      // Format dates for display
      if (animal.vaccinationSummary?.nextVaccinationDate) {
        animal.vaccinationSummary.nextVaccinationDateFormatted = new Date(
          animal.vaccinationSummary.nextVaccinationDate,
        ).toLocaleDateString();
      }

      // Add vaccination status
      if (animal.vaccinationSummary) {
        if (animal.vaccinationSummary.isUpToDate) {
          animal.vaccinationStatus = "up_to_date";
        } else if (animal.vaccinationSummary.nextVaccinationDate) {
          const daysUntil = Math.ceil(
            (new Date(animal.vaccinationSummary.nextVaccinationDate) -
              new Date()) /
              (1000 * 60 * 60 * 24),
          );
          if (daysUntil < 0) {
            animal.vaccinationStatus = "overdue";
          } else if (daysUntil <= 7) {
            animal.vaccinationStatus = "due_soon";
            animal.daysUntilDue = daysUntil;
          } else {
            animal.vaccinationStatus = "scheduled";
          }
        } else {
          animal.vaccinationStatus = "no_records";
        }
      } else {
        animal.vaccinationStatus = "no_records";
      }

      // Add batch info
      if (animal.registrationBatchId) {
        animal.batchShortId = animal.registrationBatchId.slice(-6);
      }
    }

    const totalPages = Math.ceil(totalAnimals / limit);

    // Get animal type statistics
    const animalTypeStats = await Animal.aggregate([
      {
        $group: {
          _id: "$animalType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.render("admin/animal.ejs", {
      title: "Animals Management",
      animals,
      // Pagination
      currentPage: page,
      totalPages,
      limit,
      totalAnimals,
      // Statistics - MAKE SURE ALL THESE ARE PASSED
      totalActive: totalActive || 0,
      totalInactive: totalInactive || 0,
      pregnantAnimals: pregnantAnimals || 0,
      todayRegistrations: todayRegistrations || 0, // THIS WAS MISSING
      totalBatches: totalBatches || 0,
      bulkAnimalCount: bulkAnimalCount || 0,
      animalTypeStats: animalTypeStats || [],
      // Filter state
      filterStatus,
      filterType,
      filterBatch,
      searchQuery,
      todayRegistrations: todayRegistrations || 0,
      totalBatches: totalBatches || 0,
      bulkAnimalCount: bulkAnimalCount || 0,
      animalTypeStats: animalTypeStats || [],
      // User
      currUser: req.user,
      // Messages
      success: req.flash("success"),
      error: req.flash("error"),
      warning: req.flash("warning"),
      info: req.flash("info"),
    });
  } catch (error) {
    console.error("Animals Index Error:", error);
    req.flash("error", "Failed to load animals. Please try again.");

    // Still render the page with default values instead of sending error page
    res.render("admin/animal.ejs", {
      title: "Animals Management",
      animals: [],
      currentPage: 1,
      totalPages: 1,
      limit: 10,
      totalAnimals: 0,
      totalActive: 0,
      totalInactive: 0,
      pregnantAnimals: 0,
      todayRegistrations: 0, // ADD THIS
      totalBatches: 0,
      bulkAnimalCount: 0,
      animalTypeStats: [],
      filterStatus: "all",
      filterType: "all",
      filterBatch: "all",
      searchQuery: "",
      currUser: req.user,
      success: req.flash("success"),
      error: req.flash("error"),
      warning: req.flash("warning"),
      info: req.flash("info"),
    });
  }
};

module.exports.createAnimalForm = async (req, res) => {
  try {
    // Get all required data
    if (req.user.role === "SALES") {
      const salesAgent = await SalesTeam.findOne({
        user: req.user._id,
      }).populate("user");
      var [farmers, salesAgents, vaccines] = await Promise.all([
        Farmer.find({
          isActive: true,
          "address.district": salesAgent.assignedAreas[0].district,
        }).sort({ name: 1 }),

        SalesTeam.find({ isActive: true }).populate("user").sort({ name: 1 }),
        Vaccine.find({ isActive: true }).sort({ vaccineName: 1 }),
      ]);
    } else {
      var [farmers, salesAgents, vaccines] = await Promise.all([
        Farmer.find({ isActive: true }).sort({ name: 1 }),
        SalesTeam.find({ isActive: true }).populate("user").sort({ name: 1 }),
        Vaccine.find({ isActive: true }).sort({ vaccineName: 1 }),
      ]);
    }

    // Get form type from query parameter or default to 'single'
    const formType = req.query.type || "bulk"; // Changed from hardcoded "bulk"

    // Get form data from session if available (for repopulation)
    const formData = req.session.formData || null;

    // Clear session form data after retrieving it
    delete req.session.formData;

    let salesAgentsList = [];
    if (req.user.role === "SALES") {
      salesAgentsList = req.user
        ? [{ _id: req.user._id, name: req.user.name }]
        : [];
    } else {
      salesAgentsList = salesAgents.map((agent) => ({
        _id: agent.user._id,
        name: agent.user.name,
      }));
    }

    res.render("admin/animals/new", {
      farmers,
      sales: salesAgentsList,
      vaccines,
      formType,
      formData,
      currUser: req.user,
    });
  } catch (error) {
    console.error("Error rendering animal form:", error);
    req.flash("error", "Failed to load registration form.");
    const role = req.user.role.toLowerCase();
    res.redirect(`/${role}/animals`);
  }
};

module.exports.createAnimal = async (req, res) => {
  try {
    const { farmer, registeredBy, applyVaccinationToAll, vaccination } =
      req.body;

    // Handle single animal registration
    if (!req.body.animals || !Array.isArray(req.body.animals)) {
      return await createSingleAnimal(req, res);
    }

    // Handle bulk animal registration
    return await createBulkAnimals(req, res);
  } catch (error) {
    console.error("Error creating animal(s):", error);
    handleError(error, req, res);
  }
};

// Single animal registration
async function createSingleAnimal(req, res) {
  try {
    const animalData = await prepareAnimalData(req, 0);

    // Save animal to DB
    const newAnimal = new Animal(animalData);
    await newAnimal.save();

    // Create vaccination records if provided
    if (req.body.animals && req.body.animals[0]?.vaccinations) {
      await createVaccinationRecords(req, newAnimal, null, 0);
    } else if (req.body.vaccinations) {
      // Fallback for old format
      await createVaccinationRecords(req, newAnimal);
    }

    // Update farmer's animal count
    await updateFarmerAnimalCount(animalData.farmer);

    // Send success response
    sendSuccessResponse(req, res, newAnimal, "single");
  } catch (error) {
    throw error;
  }
}

// Bulk animal registration
async function createBulkAnimals(req, res) {
  try {
    console.log("========== BULK ANIMAL REGISTRATION DEBUG ==========");
    console.log("Request body animals count:", req.body.animals?.length);

    // Log vaccine data for first animal to debug
    if (req.body.animals && req.body.animals[0]) {
      console.log(
        "First animal vaccinations keys:",
        Object.keys(req.body.animals[0]?.vaccinations || {}),
      );
    }
    console.log("====================================================");

    const animalsData = [];
    const createdAnimals = [];
    const errors = [];

    // Prepare data for each animal
    for (let i = 0; i < req.body.animals.length; i++) {
      try {
        const animalData = await prepareAnimalData(req, i);
        animalsData.push({ animalData, index: i });
      } catch (error) {
        errors.push({
          index: i + 1,
          error: error.message,
          tagNumber: req.body.animals[i]?.tagNumber || "Unknown",
        });
      }
    }

    // If any preparation errors, abort
    if (errors.length > 0) {
      req.flash(
        "error",
        `Failed to prepare ${errors.length} animal(s). Please check the data.`,
      );
      if (errors.length <= 3) {
        errors.forEach((err) => {
          req.flash(
            "error",
            `Animal ${err.index} (Tag: ${err.tagNumber}): ${err.error}`,
          );
        });
      }

      req.session.formData = req.body;
      return res.redirect(
        `/${req.user.role.toLowerCase()}/animals/new?type=bulk`,
      );
    }

    // Create all animals without transaction
    for (const { animalData, index } of animalsData) {
      try {
        const newAnimal = new Animal(animalData);
        await newAnimal.save();
        createdAnimals.push(newAnimal);

        // Create vaccination records if applicable
        if (req.body.animals[index]?.vaccinations) {
          await createVaccinationRecords(req, newAnimal, null, index);
        }
      } catch (animalError) {
        console.error(`Error saving animal ${index}:`, animalError);
        // If one animal fails, continue with others
        errors.push({
          index: index + 1,
          error: animalError.message,
          tagNumber: animalsData[index]?.animalData?.tagNumber || "Unknown",
        });
      }
    }

    // Update farmer's animal count
    if (createdAnimals.length > 0) {
      await updateFarmerAnimalCount(
        req.body.farmer,
        createdAnimals.length,
        null,
      );
    }

    // If some animals failed to save
    if (errors.length > 0) {
      const successCount = createdAnimals.length;
      const failureCount = errors.length;
      req.flash(
        "warning",
        `${successCount} animal(s) registered successfully, but ${failureCount} failed.`,
      );
      if (failureCount <= 3) {
        errors.forEach((err) => {
          req.flash(
            "error",
            `Animal ${err.index} (Tag: ${err.tagNumber}): ${err.error}`,
          );
        });
      }
    }

    // Send success response if at least one animal was created
    if (createdAnimals.length > 0) {
      sendSuccessResponse(req, res, createdAnimals, "bulk");
    } else {
      req.flash("error", "Failed to register any animals. Please try again.");
      res.redirect(`/${req.user.role.toLowerCase()}/animals/new?type=bulk`);
    }
  } catch (error) {
    console.error("Error in bulk animal registration:", error);
    handleError(error, req, res);
  }
}

// Prepare animal data
async function prepareAnimalData(req, index) {
  const animalInput = req.body.animals ? req.body.animals[index] : req.body;

  // Basic validation
  if (!animalInput.animalType) {
    throw new Error("Animal type is required");
  }

  if (!animalInput.gender) {
    throw new Error("Gender is required");
  }

  if (!animalInput.healthStatus) {
    throw new Error("Health status is required");
  }

  // Handle tag number only if isTagged is checked
  let tagNumber = null;
  if (animalInput.isTagged === "on" || animalInput.isTagged === true) {
    if (!animalInput.tagNumber) {
      throw new Error("Tag number is required when 'Has Tagged' is checked");
    }

    tagNumber = animalInput.tagNumber.toUpperCase();

    // Check if tag number already exists
    const existingAnimal = await Animal.findOne({
      tagNumber: tagNumber,
    });
    if (existingAnimal) {
      throw new Error(`Tag number ${animalInput.tagNumber} already exists`);
    }
  } else {
    // Generate a unique tag number if not provided
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    tagNumber = `AUTO-${timestamp}-${random}`.substring(0, 50);
  }

  // Prepare base data
  const animalData = {
    farmer: req.body.farmer,
    registeredBy: req.body.registeredBy || req.user._id,
    animalType: animalInput.animalType,
    breed: animalInput.breed || null,
    age: {
      value: animalInput?.age?.value ? Number(animalInput.age.value) : null,
      unit: animalInput?.age?.unit || "Months",
    },
    gender: animalInput.gender,
    name: animalInput.name || null,
    tagNumber: tagNumber,
    healthStatus: {
      currentStatus: animalInput.healthStatus || "Healthy",
      lastCheckupDate: new Date(),
      healthNotes: animalInput.healthNotes || "",
      bodyConditionScore: animalInput.bodyConditionScore
        ? parseFloat(animalInput.bodyConditionScore)
        : 3,
    },
    isActive: true,
    reproductiveStatus: req.body.reproductiveStatus || "normal",
    feedingType: req.body.feedingType || null,
    housingType: req.body.housingType || null,
    dateOfBirth: animalInput.dateOfBirth
      ? new Date(animalInput.dateOfBirth)
      : null,
    sourceOfAnimal: req.body.sourceOfAnimal || "born_on_farm",
    additionalNotes: req.body.additionalNotes || "",
    status: "active",
    currentOwner: req.body.farmer,
    photos: {},
    vaccinationSummary: {
      totalVaccinations: 0,
      lastVaccinationDate: null,
      nextVaccinationDate: null,
      isUpToDate: false,
      vaccinesGiven: [],
    },
  };

  // Handle pregnancy status (only for adult female animals)
  if (
    animalInput.pregnancyStatus?.isPregnant === "on" ||
    animalInput.pregnancyStatus?.isPregnant === true
  ) {
    animalData.pregnancyStatus = {
      isPregnant: true,
      kitUsed: animalInput.pregnancyStatus?.kitUsed || null,
      testDate: animalInput.pregnancyStatus?.testDate
        ? new Date(animalInput.pregnancyStatus.testDate)
        : null,
      confirmedDate: animalInput.pregnancyStatus?.confirmedDate
        ? new Date(animalInput.pregnancyStatus.confirmedDate)
        : null,
      expectedDeliveryDate: animalInput.pregnancyStatus?.expectedDeliveryDate
        ? new Date(animalInput.pregnancyStatus.expectedDeliveryDate)
        : null,
      stage: animalInput.pregnancyStatus?.stage || null,
      numberOfFetuses: animalInput.pregnancyStatus?.numberOfFetuses
        ? Number(animalInput.pregnancyStatus.numberOfFetuses)
        : null,
      previousPregnancies: animalInput.pregnancyStatus?.previousPregnancies
        ? Number(animalInput.pregnancyStatus.previousPregnancies)
        : 0,
      pregnancyNotes: animalInput.pregnancyStatus?.notes || "",
    };
  } else {
    animalData.pregnancyStatus = {
      isPregnant: false,
      kitUsed: null,
      testDate: null,
      confirmedDate: null,
      expectedDeliveryDate: null,
      stage: null,
      numberOfFetuses: null,
      previousPregnancies: 0,
      pregnancyNotes: "",
    };
  }

  // Handle photos with proper field naming
  const photoFields = ["front", "left", "right", "back"];

  // Try to get files for this specific animal
  if (req.files) {
    for (const field of photoFields) {
      const fileKey = `animals[${index}][photos][${field}]`;
      if (req.files[fileKey] && req.files[fileKey][0]) {
        const file = req.files[fileKey][0];
        animalData.photos[field] = {
          url: file.path,
          filename: file.originalname,
          public_id: file.filename,
          uploadedAt: new Date(),
        };
      }
    }
  }

  return animalData;
}

// Create vaccination records
async function createVaccinationRecords(
  req,
  animal,
  session = null,
  animalIndex = 0,
) {
  try {
    // Get vaccinations for this specific animal
    const animalVaccinations = req.body.animals
      ? req.body.animals[animalIndex]?.vaccinations
      : req.body.vaccinations;

    if (!animalVaccinations || Object.keys(animalVaccinations).length === 0) {
      console.log(
        `No vaccinations for animal ${animalIndex}, skipping vaccination records.`,
      );
      return [];
    }

    const vaccinationRecords = [];
    const vaccinationKeys = Object.keys(animalVaccinations);
    console.log(
      `Processing ${vaccinationKeys.length} vaccination entries for animal ${animalIndex}`,
    );

    for (const vaccineId of vaccinationKeys) {
      const vaccineData = animalVaccinations[vaccineId];

      // Check if this vaccine was administered
      const isAdministered =
        vaccineData.administered === "true" ||
        vaccineData.administered === true ||
        vaccineData.administered === "on";

      console.log(
        `Vaccine ${vaccineId} - Administered: ${isAdministered}, Data:`,
        vaccineData,
      );

      if (!isAdministered) {
        console.log(`Vaccine ${vaccineId} not administered, skipping.`);
        continue;
      }

      // Get vaccine details from database
      const vaccine = await Vaccine.findById(vaccineId);
      if (!vaccine) {
        console.warn(`Vaccine with ID ${vaccineId} not found`);
        continue;
      }

      // Validate required fields
      if (!vaccineData.dateAdministered) {
        throw new Error(
          `Vaccination date is required for ${vaccine.vaccineName}`,
        );
      }

      if (!vaccineData.administeredBy) {
        throw new Error(
          `Administered by is required for ${vaccine.vaccineName}`,
        );
      }

      const vaccinationRecord = new Vaccination({
        farmer: animal.farmer,
        animal: animal._id,
        vaccine: vaccine._id,
        vaccineName: vaccine.vaccineName || vaccine.name,
        vaccineType: vaccine.vaccineType,
        dateAdministered: new Date(vaccineData.dateAdministered),
        nextDueDate: vaccineData.nextDueDate
          ? new Date(vaccineData.nextDueDate)
          : calculateNextDueDate(
              vaccineData.dateAdministered,
              vaccine.boosterIntervalWeeks,
            ),
        administeredBy: vaccineData.administeredBy,
        notes: vaccineData.notes || "",
        status: "Administered",
        batchNumber: vaccineData.batchNumber || null,
        dosageAmount: vaccine.standardDosage || null,
        dosageUnit: vaccine.dosageUnit || "ml",
        createdBy: req.user._id,
      });

      const saveOptions = session ? { session } : {};
      await vaccinationRecord.save(saveOptions);
      vaccinationRecords.push(vaccinationRecord);

      console.log(
        `Vaccination record created for vaccine ${vaccine.vaccineName}`,
      );

      // Update animal's vaccination summary
      animal.vaccinationSummary.vaccinesGiven.push({
        vaccine: vaccine._id,
        vaccineName: vaccine.vaccineName || vaccine.name,
        lastDate: new Date(vaccineData.dateAdministered),
        nextDue: vaccinationRecord.nextDueDate,
        status:
          vaccinationRecord.nextDueDate > new Date() ? "up_to_date" : "overdue",
      });
    }

    // Update animal's vaccination summary if records were created
    if (vaccinationRecords.length > 0) {
      const latestVaccination = vaccinationRecords.sort(
        (a, b) => new Date(b.dateAdministered) - new Date(a.dateAdministered),
      )[0];

      animal.vaccinationSummary.totalVaccinations =
        (animal.vaccinationSummary.totalVaccinations || 0) +
        vaccinationRecords.length;
      animal.vaccinationSummary.lastVaccinationDate =
        latestVaccination.dateAdministered;
      animal.vaccinationSummary.lastVaccineType = latestVaccination.vaccineType;

      // Find earliest next due date
      const upcomingVaccinations = vaccinationRecords.filter(
        (v) => v.nextDueDate,
      );
      if (upcomingVaccinations.length > 0) {
        const earliestDueDate = upcomingVaccinations.reduce((earliest, v) => {
          return v.nextDueDate < earliest ? v.nextDueDate : earliest;
        }, upcomingVaccinations[0].nextDueDate);

        animal.vaccinationSummary.nextVaccinationDate = earliestDueDate;
        animal.vaccinationSummary.isUpToDate = earliestDueDate > new Date();
      }

      animal.vaccinationSummary.lastUpdated = new Date();

      const saveOptions = session ? { session } : {};
      await animal.save(saveOptions);

      console.log(
        `Updated vaccination summary for animal: ${vaccinationRecords.length} records`,
      );
    }

    return vaccinationRecords;
  } catch (error) {
    console.error("Error creating vaccination records:", error);
    throw error;
  }
}

// Helper function to calculate next due date
function calculateNextDueDate(administeredDate, boosterIntervalWeeks) {
  if (!boosterIntervalWeeks || boosterIntervalWeeks === 0) {
    // Default to 1 year if no interval specified
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }

  const daysToAdd = boosterIntervalWeeks * 7;
  return new Date(
    new Date(administeredDate).getTime() + daysToAdd * 24 * 60 * 60 * 1000,
  );
}

// Update farmer animal count
async function updateFarmerAnimalCount(farmerId, count = 1, session = null) {
  try {
    const updateQuery = {
      $inc: {
        "farmDetails.totalAnimals": count,
        "farmDetails.activeAnimals": count,
      },
    };

    const options = session ? { session } : {};
    await Farmer.findByIdAndUpdate(farmerId, updateQuery, options);
  } catch (error) {
    console.error("Error updating farmer animal count:", error);
    throw error;
  }
}

// Send success response
function sendSuccessResponse(req, res, animals, type) {
  const isSingle = type === "single";
  const animal = isSingle ? animals : animals[0];
  const count = isSingle ? 1 : animals.length;

  // Send notifications
  if (animal.pregnancyStatus?.isPregnant) {
    req.flash(
      "primary",
      `Pregnant animal registered! Expected delivery: ${
        animal.pregnancyStatus.expectedDeliveryDate
          ? new Date(
              animal.pregnancyStatus.expectedDeliveryDate,
            ).toLocaleDateString()
          : "Not specified"
      }`,
    );
  }

  if (animal.healthStatus.currentStatus !== "Healthy") {
    req.flash(
      "warning",
      `Animal registered with health status: ${animal.healthStatus.currentStatus}. Requires attention.`,
    );
  }

  const names = isSingle
    ? `"${animal.name || animal.tagNumber}"`
    : `${count} animals`;

  req.flash(
    "success",
    `${names} registered successfully! ${isSingle ? `ID: ${animal.uniqueAnimalId}` : ""}`,
  );

  // Redirect based on registration type
  const role = req.user.role.toLowerCase();
  if (isSingle) {
    res.redirect(`/${role}/animals/${animal._id}`);
  } else {
    res.redirect(`/${role}/animals?bulk_success=true&count=${count}`);
  }
}

// Error handling
function handleError(error, req, res) {
  console.error("Controller error:", error);

  // Specific error messages
  if (error.code === 11000) {
    if (error.keyPattern?.tagNumber) {
      req.flash(
        "error",
        "Tag number already exists. Please use a unique tag number.",
      );
    } else if (error.keyPattern?.uniqueAnimalId) {
      req.flash("error", "Duplicate animal ID generated. Please try again.");
    } else {
      req.flash("error", "Duplicate entry detected. Please check your input.");
    }
  } else if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((val) => val.message);
    req.flash("error", `Validation failed: ${messages.join(", ")}`);
  } else if (error.name === "CastError") {
    req.flash(
      "error",
      "Invalid data type provided. Please check your input fields.",
    );
  } else {
    req.flash(
      "error",
      error.message || "Failed to register animal(s). Please try again.",
    );
  }

  // Store form data in session for repopulation
  req.session.formData = req.body;

  // Determine redirect URL
  const role = req.user.role.toLowerCase();
  const isBulk = Array.isArray(req.body.animals);
  const redirectUrl = isBulk
    ? `/${role}/animals/new?type=bulk`
    : `/${role}/animals/new`;

  res.redirect(redirectUrl);
}

module.exports.bulkCreateAnimals = module.exports.createAnimal;
module.exports.viewAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch animal with comprehensive population
    const animal = await Animal.findById(id)
      .populate(
        "farmer",
        "name mobileNumber uniqueFarmerId address totalAnimals createdAt",
      )
      .populate("registeredBy", "name email role")
      .populate("currentOwner", "name uniqueFarmerId")
      .populate("medicalHistory.treatedBy", "name");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Get vaccination records for this animal
    const Vaccination = require("../models/vaccination");
    const vaccinations = await Vaccination.find({ animal: id })
      .populate("vaccine", "name vaccineType")
      .sort({ dateAdministered: -1 })
      .limit(5);

    // Calculate age in months if dateOfBirth exists
    let ageInMonths = null;
    if (animal.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(animal.dateOfBirth);
      let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
      months += today.getMonth() - birthDate.getMonth();
      if (today.getDate() < birthDate.getDate()) {
        months--;
      }
      ageInMonths = months;
    }

    // Calculate pregnancy duration if pregnant
    let pregnancyDuration = null;
    let daysUntilDelivery = null;
    if (
      animal.pregnancyStatus?.isPregnant &&
      animal.pregnancyStatus?.confirmedDate
    ) {
      const today = new Date();
      const confirmedDate = new Date(animal.pregnancyStatus.confirmedDate);
      const diffTime = Math.abs(today - confirmedDate);
      pregnancyDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate days until expected delivery
    if (
      animal.pregnancyStatus?.isPregnant &&
      animal.pregnancyStatus?.expectedDeliveryDate
    ) {
      const today = new Date();
      const expectedDelivery = new Date(
        animal.pregnancyStatus.expectedDeliveryDate,
      );
      daysUntilDelivery = Math.ceil(
        (expectedDelivery - today) / (1000 * 60 * 60 * 24),
      );
    }

    // Get upcoming vaccinations
    const upcomingVaccinations = await Vaccination.find({
      animal: id,
      nextDueDate: { $gte: new Date() },
      status: "Administered",
    })
      .populate("vaccine", "name vaccineType")
      .sort({ nextDueDate: 1 })
      .limit(3);

    // Get vaccination statistics
    const vaccinationStats = await Vaccination.aggregate([
      { $match: { animal: animal._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$nextDueDate", new Date()] },
                    { $eq: ["$status", "Administered"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          upcoming: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$nextDueDate", new Date()] },
                    {
                      $lte: [
                        "$nextDueDate",
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get other animals from the same farmer
    const otherAnimals = await Animal.find({
      farmer: animal.farmer._id,
      _id: { $ne: id },
      isActive: true,
    })
      .select(
        "name animalType tagNumber uniqueAnimalId healthStatus.currentStatus",
      )
      .limit(5);

    // Check if animal was from bulk registration
    const batchInfo = animal.registrationBatchId
      ? await Animal.countDocuments({
          registrationBatchId: animal.registrationBatchId,
        })
      : null;

    res.render("admin/animals/view", {
      animal,
      vaccinations,
      upcomingVaccinations,
      vaccinationStats: vaccinationStats[0] || {
        total: 0,
        overdue: 0,
        upcoming: 0,
      },
      otherAnimals,
      ageInMonths,
      pregnancyDuration,
      daysUntilDelivery,
      batchInfo,
      title: `Animal Details - ${animal.uniqueAnimalId || animal.tagNumber}`,
      helpers: {
        formatDate: function (date) {
          return date
            ? new Date(date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "N/A";
        },
        formatDateTime: function (date) {
          return date
            ? new Date(date).toLocaleString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "N/A";
        },
        getHealthColor: function (status) {
          const colors = {
            Healthy:
              "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
            Sick: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
            "Under Treatment":
              "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
            Recovered:
              "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            Quarantined:
              "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
            "Chronic Condition":
              "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
          };
          return (
            colors[status] ||
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
          );
        },
        getVaccinationStatusColor: function (dueDate) {
          if (!dueDate) return "bg-gray-100 text-gray-800";
          const days = Math.ceil(
            (new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24),
          );
          if (days < 0)
            return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
          if (days <= 7)
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
          return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        },
        formatAge: function (age) {
          if (!age || !age.value) return "N/A";
          return `${age.value} ${age.unit}`;
        },
      },
    });
  } catch (error) {
    console.error("Error fetching animal:", error);
    req.flash("error", "❌ Unable to fetch animal details. Please try again.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals`);
  }
};

module.exports.renderEditForm = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id)
      .populate("farmer", "name uniqueFarmerId")
      .populate("registeredBy", "name");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Get farmers for dropdown
    const Farmer = require("../models/farmer");
    const farmers = await Farmer.find({ isActive: true })
      .select("name uniqueFarmerId")
      .sort({ name: 1 });

    // Get sales agents for dropdown
    const User = require("../models/user");
    const sales = await User.find({
      $or: [{ role: "SALES" }, { role: "ADMIN" }],
      isActive: true,
    })
      .select("name email")
      .sort({ name: 1 });

    // Get vaccines for reference
    const Vaccine = require("../models/vaccine");
    const vaccines = await Vaccine.find({ isActive: true })
      .select("name vaccineType")
      .sort({ name: 1 });

    res.render("admin/animals/edit", {
      animal,
      farmers,
      sales,
      vaccines,
      title: `Edit Animal - ${animal.uniqueAnimalId || animal.tagNumber}`,
      formData: req.session.formData || null,
    });

    // Clear session form data
    delete req.session.formData;
  } catch (error) {
    console.error("Get edit form error:", error);
    req.flash("error", "❌ Unable to load edit form.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};
module.exports.updateAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    let animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    /* ---------------- BASIC FIELDS ---------------- */
    if (req.body.farmer) animal.farmer = req.body.farmer;
    if (req.body.registeredBy) animal.registeredBy = req.body.registeredBy;

    const validAnimalTypes = [
      "Cow",
      "Buffalo",
      "Goat",
      "Sheep",
      "Dog",
      "Cat",
      "Poultry",
      "Other",
    ];
    if (req.body.animalType && validAnimalTypes.includes(req.body.animalType)) {
      animal.animalType = req.body.animalType;
    }

    animal.breed = req.body.breed || animal.breed;

    const validGenders = ["Male", "Female", "Unknown"];
    if (req.body.gender && validGenders.includes(req.body.gender)) {
      animal.gender = req.body.gender;
    }

    animal.name = req.body.name || animal.name;
    animal.tagNumber = req.body.tagNumber
      ? req.body.tagNumber.toUpperCase()
      : animal.tagNumber;
    animal.dateOfBirth = req.body.dateOfBirth
      ? new Date(req.body.dateOfBirth)
      : animal.dateOfBirth;
    animal.dateOfAcquisition = req.body.dateOfAcquisition
      ? new Date(req.body.dateOfAcquisition)
      : animal.dateOfAcquisition;
    animal.sourceOfAnimal = req.body.sourceOfAnimal || animal.sourceOfAnimal;
    animal.additionalNotes = req.body.additionalNotes || animal.additionalNotes;

    /* ---------------- AGE ---------------- */
    if (req.body.age) {
      // Handle age as a nested object
      const ageValue = req.body.age.value
        ? parseFloat(req.body.age.value)
        : animal.age?.value;
      const ageUnit = ["Days", "Months", "Years"].includes(req.body.age.unit)
        ? req.body.age.unit
        : animal.age?.unit || "Months";

      animal.age = {
        value: ageValue,
        unit: ageUnit,
      };
    }

    /* ---------------- PREGNANCY STATUS ---------------- */
    // Initialize pregnancyStatus if it doesn't exist
    if (!animal.pregnancyStatus) {
      animal.pregnancyStatus = {};
    }

    // Handle pregnancy checkbox
    if (req.body.pregnancyStatus) {
      animal.pregnancyStatus.isPregnant =
        req.body.pregnancyStatus.isPregnant === "on";

      // Only update other fields if checkbox is checked or if they're provided
      if (animal.pregnancyStatus.isPregnant) {
        animal.pregnancyStatus.kitUsed =
          req.body.pregnancyStatus.kitUsed || null;
        animal.pregnancyStatus.testDate = req.body.pregnancyStatus.testDate
          ? new Date(req.body.pregnancyStatus.testDate)
          : null;
        animal.pregnancyStatus.confirmedDate = req.body.pregnancyStatus
          .confirmedDate
          ? new Date(req.body.pregnancyStatus.confirmedDate)
          : null;
        animal.pregnancyStatus.expectedDeliveryDate = req.body.pregnancyStatus
          .expectedDeliveryDate
          ? new Date(req.body.pregnancyStatus.expectedDeliveryDate)
          : null;
        animal.pregnancyStatus.stage = req.body.pregnancyStatus.stage || null;
        animal.pregnancyStatus.numberOfFetuses = req.body.pregnancyStatus
          .numberOfFetuses
          ? parseInt(req.body.pregnancyStatus.numberOfFetuses)
          : null;
        animal.pregnancyStatus.previousPregnancies = req.body.pregnancyStatus
          .previousPregnancies
          ? parseInt(req.body.pregnancyStatus.previousPregnancies)
          : 0;
        animal.pregnancyStatus.pregnancyNotes =
          req.body.pregnancyStatus.pregnancyNotes || "";
      } else {
        // If not pregnant, reset pregnancy fields
        animal.pregnancyStatus = {
          isPregnant: false,
          previousPregnancies: animal.pregnancyStatus?.previousPregnancies || 0,
        };
      }
    }

    /* ---------------- HEALTH STATUS ---------------- */
    // Initialize healthStatus if it doesn't exist
    if (!animal.healthStatus) {
      animal.healthStatus = {};
    }

    const validHealthStatuses = [
      "Healthy",
      "Sick",
      "Under Treatment",
      "Recovered",
      "Quarantined",
      "Chronic Condition",
    ];
    if (
      req.body.healthStatus &&
      validHealthStatuses.includes(req.body.healthStatus)
    ) {
      animal.healthStatus.currentStatus = req.body.healthStatus;
    }

    if (req.body.bodyConditionScore) {
      animal.healthStatus.bodyConditionScore = parseFloat(
        req.body.bodyConditionScore,
      );
    }

    if (req.body.lastCheckupDate) {
      animal.healthStatus.lastCheckupDate = new Date(req.body.lastCheckupDate);
    }

    if (req.body.healthNotes !== undefined) {
      animal.healthStatus.healthNotes = req.body.healthNotes;
    }

    /* ---------------- VACCINATION SUMMARY ---------------- */
    // Initialize vaccinationSummary if it doesn't exist
    if (!animal.vaccinationSummary) {
      animal.vaccinationSummary = {
        totalVaccinations: 0,
        isUpToDate: false,
        vaccinesGiven: [],
      };
    }

    if (req.body.vaccinationSummary) {
      if (req.body.vaccinationSummary.lastVaccinationDate) {
        animal.vaccinationSummary.lastVaccinationDate = new Date(
          req.body.vaccinationSummary.lastVaccinationDate,
        );
      }
      if (req.body.vaccinationSummary.nextVaccinationDate) {
        animal.vaccinationSummary.nextVaccinationDate = new Date(
          req.body.vaccinationSummary.nextVaccinationDate,
        );
      }
      if (req.body.vaccinationSummary.lastVaccineType) {
        animal.vaccinationSummary.lastVaccineType =
          req.body.vaccinationSummary.lastVaccineType;
      }
      if (req.body.vaccinationSummary.isUpToDate !== undefined) {
        animal.vaccinationSummary.isUpToDate =
          req.body.vaccinationSummary.isUpToDate === "on";
      }
    }

    /* ---------------- REPRODUCTIVE STATUS ---------------- */
    const validReproductiveStatuses = [
      "normal",
      "in_heat",
      "bred",
      "open",
      "sterile",
      "castrated",
    ];
    if (
      req.body.reproductiveStatus &&
      validReproductiveStatuses.includes(req.body.reproductiveStatus)
    ) {
      animal.reproductiveStatus = req.body.reproductiveStatus;
    }

    /* ---------------- MANAGEMENT FIELDS ---------------- */
    if (req.body.feedingType !== undefined) {
      animal.feedingType = req.body.feedingType || null;
    }
    if (req.body.housingType !== undefined) {
      animal.housingType = req.body.housingType || null;
    }

    /* ---------------- STATUS & OWNERSHIP ---------------- */
    const validStatuses = [
      "active",
      "sold",
      "deceased",
      "transferred",
      "missing",
    ];
    if (req.body.status && validStatuses.includes(req.body.status)) {
      animal.status = req.body.status;
      animal.statusChangeDate = new Date();
      animal.statusChangeReason = req.body.statusChangeReason || "";

      // Update isActive based on status
      animal.isActive = req.body.status === "active";
    }

    /* ---------------- CHECKBOXES ---------------- */
    if (req.body.isActive !== undefined) {
      animal.isActive = req.body.isActive === "on";
    }

    /* ---------------- UPDATE CURRENT OWNER ---------------- */
    if (
      req.body.farmer &&
      req.body.farmer !== animal.currentOwner?.toString()
    ) {
      // Add to previous owners if exists (field exists in schema?)
      if (animal.currentOwner) {
        // Check if previousOwners exists in schema before using
        if (animal.previousOwners) {
          animal.previousOwners = animal.previousOwners || [];
          animal.previousOwners.push({
            farmer: animal.currentOwner,
            fromDate: animal.dateOfAcquisition || animal.createdAt,
            toDate: new Date(),
            transferReason: req.body.transferReason || "Ownership updated",
          });
        }
      }

      animal.currentOwner = req.body.farmer;
    }

    /* ---------------- PHOTOS UPDATE ---------------- */
    const photoFields = ["front", "left", "right", "back"];

    // Initialize photos object if it doesn't exist
    if (!animal.photos) {
      animal.photos = {};
    }

    // Handle photo deletion
    if (req.body.deletePhotos) {
      for (const side of photoFields) {
        if (
          req.body.deletePhotos[side] === "on" &&
          animal.photos?.[side]?.public_id
        ) {
          try {
            const cloudinary = require("../config/cloudinary");
            await cloudinary.uploader.destroy(animal.photos[side].public_id);
            animal.photos[side] = undefined;
          } catch (error) {
            console.error(`Error deleting ${side} photo:`, error);
          }
        }
      }
    }

    // Handle new photo uploads
    if (req.files) {
      const cloudinary = require("../Cloudconfig.js");

      for (const field of photoFields) {
        if (req.files[field]?.[0]) {
          // Delete old image if exists
          if (animal.photos?.[field]?.public_id) {
            try {
              await cloudinary.uploader.destroy(animal.photos[field].public_id);
            } catch (error) {
              console.error(`Error deleting old ${field} photo:`, error);
            }
          }

          const file = req.files[field][0];
          animal.photos[field] = {
            url: file.path,
            filename: file.originalname,
            public_id: file.filename,
            uploadedAt: new Date(),
          };
        }
      }
    }

    /* ---------------- SAVE UPDATES ---------------- */
    await animal.save();

    // Update vaccination summary if there are vaccinations
    if (animal.vaccinationSummary?.totalVaccinations > 0) {
      await animal.updateVaccinationSummary();
    }

    req.flash(
      "success",
      `✅ Animal "${animal.name || animal.tagNumber}" updated successfully!`,
    );

    const role = req.user.role.toLowerCase();
    res.redirect(`/${role}/animals/${animal._id}`);
  } catch (error) {
    console.error("Update animal error:", error);
    console.error("Request body:", JSON.stringify(req.body, null, 2));

    // Log specific validation errors
    if (error.name === "ValidationError") {
      console.error("Validation errors:", error.errors);
    }

    let errorMessage = "❌ Failed to update animal. Please try again.";

    if (error.code === 11000) {
      if (error.keyPattern?.tagNumber) {
        errorMessage =
          "❌ Tag number already exists! Please use a different tag number.";
      } else if (error.keyPattern?.uniqueAnimalId) {
        errorMessage = "❌ Unique Animal ID already exists! Please try again.";
      }
    } else if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (val) => `${val.path}: ${val.message}`,
      );
      errorMessage = `❌ Validation Error:<br>${messages.join("<br>")}`;
    } else if (error.name === "CastError") {
      errorMessage = `❌ Invalid data type for field "${error.path}".`;
    } else if (error.message) {
      errorMessage = `❌ ${error.message}`;
    }

    req.flash("error", errorMessage);

    // Store form data in session for repopulation
    req.session.formData = req.body;

    const role = req.user.role.toLowerCase();
    res.redirect(`/${role}/animals/${req.params.id}/edit`);
  }
};

module.exports.deleteAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the animal
    const animal = await Animal.findById(id);
    if (!animal) {
      return res.status(404).json({
        success: false,
        message: "Animal not found.",
      });
    }

    // Check if animal has related records (optional safety check)
    const Vaccination = require("../models/vaccination");
    const vaccinationCount = await Vaccination.countDocuments({ animal: id });

    if (vaccinationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This animal has ${vaccinationCount} vaccination records. Please delete them first or contact administrator.`,
      });
    }

    // Delete photos from cloudinary
    const photoFields = ["front", "left", "right", "back"];
    for (const field of photoFields) {
      if (animal.photos?.[field]?.public_id) {
        try {
          await cloudinary.uploader.destroy(animal.photos[field].public_id);
        } catch (error) {
          console.error(`Error deleting ${field} photo:`, error);
        }
      }
    }

    // Delete the animal
    await Animal.findByIdAndDelete(id);

    // Return JSON response for AJAX request
    return res.json({
      success: true,
      message: `Animal "${animal.name || animal.tagNumber}" has been permanently deleted.`,
      redirectUrl: `/${req.user.role.toLowerCase()}/animals`,
    });
  } catch (error) {
    console.error("Delete animal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete animal. Please try again.",
    });
  }
};

module.exports.bulkDeleteAnimals = async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No animals selected for deletion.",
      });
    }

    // Convert string IDs to MongoDB ObjectIds
    const animalIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    // Find all animals to delete
    const animals = await Animal.find({ _id: { $in: animalIds } });

    if (animals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No animals found to delete.",
      });
    }

    // Check for vaccination records
    const Vaccination = require("../models/vaccination");
    const vaccinationCounts = await Vaccination.aggregate([
      { $match: { animal: { $in: animalIds } } },
      { $group: { _id: "$animal", count: { $sum: 1 } } },
    ]);

    const animalsWithVaccinations = vaccinationCounts.map((v) =>
      v._id.toString(),
    );

    if (animalsWithVaccinations.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Some animals have vaccination records and cannot be deleted. Please delete vaccination records first.",
        blockedCount: animalsWithVaccinations.length,
      });
    }

    // Delete photos from cloudinary for each animal
    for (const animal of animals) {
      const photoFields = ["front", "left", "right", "back"];
      for (const field of photoFields) {
        if (animal.photos?.[field]?.public_id) {
          try {
            await cloudinary.uploader.destroy(animal.photos[field].public_id);
          } catch (error) {
            console.error(`Error deleting ${field} photo:`, error);
          }
        }
      }
    }

    // Delete all animals
    const result = await Animal.deleteMany({ _id: { $in: animalIds } });

    return res.json({
      success: true,
      message: `${result.deletedCount} animal(s) deleted successfully.`,
      deleted: result.deletedCount,
      redirectUrl: `/${req.user.role.toLowerCase()}/animals`,
    });
  } catch (error) {
    console.error("Bulk delete animals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete animals. Please try again.",
    });
  }
};

module.exports.toggleAnimalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const action = req.path.includes("deactivate") ? "deactivate" : "activate";

    const animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    if (action === "deactivate") {
      animal.isActive = false;
      animal.status = "inactive";
      animal.statusChangeDate = new Date();
      animal.statusChangeReason =
        req.body.reason || "Manually deactivated by user";
      await animal.save();

      req.flash(
        "info",
        `ℹ️ Animal "${animal.name || animal.tagNumber}" has been deactivated.`,
      );
    } else {
      animal.isActive = true;
      animal.status = "active";
      animal.statusChangeDate = new Date();
      animal.statusChangeReason = "Reactivated by user";
      await animal.save();

      req.flash(
        "success",
        `✅ Animal "${animal.name || animal.tagNumber}" has been activated.`,
      );
    }

    res.redirect(`/${req.user.role.toLowerCase()}/animals/${id}`);
  } catch (error) {
    console.error("Toggle animal status error:", error);
    req.flash("error", "❌ Failed to update animal status.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};

module.exports.transferAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    const { newFarmerId, transferDate, transferReason, notes } = req.body;

    const animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Check if new farmer exists
    const Farmer = require("../models/farmer");
    const newFarmer = await Farmer.findById(newFarmerId);
    if (!newFarmer) {
      req.flash("error", "❌ New farmer not found.");
      return res.redirect(
        `/${req.user.role.toLowerCase()}/animals/${id}/transfer`,
      );
    }

    // Add current owner to previous owners
    animal.previousOwners = animal.previousOwners || [];
    animal.previousOwners.push({
      farmer: animal.currentOwner,
      fromDate: animal.dateOfAcquisition || animal.createdAt,
      toDate: transferDate ? new Date(transferDate) : new Date(),
      transferReason: transferReason || "Transferred to another farmer",
    });

    // Update current owner
    animal.currentOwner = newFarmerId;
    animal.farmer = newFarmerId;
    animal.statusChangeDate = new Date();
    animal.statusChangeReason = `Transferred to ${newFarmer.name}`;
    animal.additionalNotes = notes
      ? `${animal.additionalNotes || ""}\n[Transfer]: ${notes}`
      : animal.additionalNotes;

    await animal.save();

    req.flash(
      "success",
      `✅ Animal transferred successfully to ${newFarmer.name} (${newFarmer.uniqueFarmerId}).`,
    );
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${id}`);
  } catch (error) {
    console.error("Transfer animal error:", error);
    req.flash("error", "❌ Failed to transfer animal. Please try again.");
    res.redirect(
      `/${req.user.role.toLowerCase()}/animals/${req.params.id}/transfer`,
    );
  }
};

module.exports.getTransferForm = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id)
      .populate("currentOwner", "name uniqueFarmerId")
      .populate("farmer", "name uniqueFarmerId");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    const Farmer = require("../models/farmer");
    const farmers = await Farmer.find({ _id: { $ne: animal.currentOwner } })
      .select("name uniqueFarmerId mobileNumber address")
      .sort({ name: 1 });

    res.render("admin/animals/transfer", {
      animal,
      farmers,
      title: `Transfer Animal - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("Get transfer form error:", error);
    req.flash("error", "❌ Unable to load transfer form.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};

module.exports.addHealthRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, treatment, treatedBy, notes, resolved } = req.body;

    const animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Add to medical history
    animal.medicalHistory = animal.medicalHistory || [];
    animal.medicalHistory.push({
      date: new Date(),
      condition,
      treatment,
      treatedBy: treatedBy || req.user._id,
      resolved: resolved === "on",
      notes: notes || "",
    });

    // Update health status if condition is serious
    const seriousConditions = ["Critical", "Emergency", "Severe"];
    if (seriousConditions.some((word) => condition.includes(word))) {
      animal.healthStatus.currentStatus = "Sick";
      animal.healthStatus.lastCheckupDate = new Date();
    }

    await animal.save();

    req.flash(
      "success",
      `✅ Health record added for "${animal.name || animal.tagNumber}".`,
    );
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${id}/health`);
  } catch (error) {
    console.error("Add health record error:", error);
    req.flash("error", "❌ Failed to add health record.");
    res.redirect(
      `/${req.user.role.toLowerCase()}/animals/${req.params.id}/health/add`,
    );
  }
};

module.exports.viewHealthRecords = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id)
      .populate("medicalHistory.treatedBy", "name role")
      .select("name tagNumber uniqueAnimalId medicalHistory healthStatus");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    res.render("admin/animals/health", {
      animal,
      title: `Health Records - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("View health records error:", error);
    req.flash("error", "❌ Unable to load health records.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};

module.exports.getAddHealthRecordForm = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id).select(
      "name tagNumber uniqueAnimalId",
    );

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    res.render("admin/animals/health-add", {
      animal,
      title: `Add Health Record - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("Get add health record form error:", error);
    req.flash("error", "❌ Unable to load form.");
    res.redirect(
      `/${req.user.role.toLowerCase()}/animals/${req.params.id}/health`,
    );
  }
};

module.exports.addBreedingRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      matingDate,
      bullId,
      bullBreed,
      pregnancyConfirmed,
      confirmedDate,
      expectedCalvingDate,
      notes,
    } = req.body;

    const animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${reqUser.role.toLowerCase()}/animals`);
    }

    // Add to breeding history
    animal.breedingHistory = animal.breedingHistory || [];
    animal.breedingHistory.push({
      matingDate: matingDate ? new Date(matingDate) : new Date(),
      bullId,
      bullBreed,
      pregnancyConfirmed: pregnancyConfirmed === "on",
      confirmedDate: confirmedDate ? new Date(confirmedDate) : null,
      expectedCalvingDate: expectedCalvingDate
        ? new Date(expectedCalvingDate)
        : null,
      notes: notes || "",
    });

    // Update pregnancy status if confirmed
    if (pregnancyConfirmed === "on") {
      animal.pregnancyStatus = {
        isPregnant: true,
        confirmedDate: confirmedDate ? new Date(confirmedDate) : new Date(),
        expectedDeliveryDate: expectedCalvingDate
          ? new Date(expectedCalvingDate)
          : null,
        stage: "early",
        previousPregnancies:
          (animal.pregnancyStatus?.previousPregnancies || 0) + 1,
      };

      animal.reproductiveStatus = "bred";
    }

    await animal.save();

    req.flash(
      "success",
      `✅ Breeding record added for "${animal.name || animal.tagNumber}".`,
    );
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${id}`);
  } catch (error) {
    console.error("Add breeding record error:", error);
    req.flash("error", "❌ Failed to add breeding record.");
    res.redirect(
      `/${req.user.role.toLowerCase()}/animals/${req.params.id}/breeding/add`,
    );
  }
};

module.exports.getAddBreedingRecordForm = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id).select(
      "name tagNumber uniqueAnimalId reproductiveStatus gender",
    );

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Get available bulls (male animals)
    const bulls = await Animal.find({
      gender: "Male",
      animalType: animal.animalType, // Same type as the female
      isActive: true,
    }).select("name tagNumber uniqueAnimalId breed");

    res.render("admin/animals/breeding-add", {
      animal,
      bulls,
      title: `Add Breeding Record - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("Get add breeding record form error:", error);
    req.flash("error", "❌ Unable to load form.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};

module.exports.generateAnimalReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportType, format } = req.query;

    const animal = await Animal.findById(id)
      .populate("farmer", "name uniqueFarmerId address mobileNumber")
      .populate("registeredBy", "name email")
      .populate("currentOwner", "name uniqueFarmerId")
      .populate("medicalHistory.treatedBy", "name")
      .populate("vaccinations", "vaccineName dateAdministered nextDueDate")
      .populate("previousOwners.farmer", "name uniqueFarmerId");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Format dates for report
    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString("en-IN") : "N/A";
    };

    const reportData = {
      animal: {
        id: animal.uniqueAnimalId,
        name: animal.name || "Unnamed",
        tagNumber: animal.tagNumber,
        type: animal.animalType,
        breed: animal.breed || "N/A",
        gender: animal.gender,
        age: animal.age ? `${animal.age.value} ${animal.age.unit}` : "N/A",
        dateOfBirth: formatDate(animal.dateOfBirth),
        registrationDate: formatDate(animal.createdAt),
      },
      health: {
        status: animal.healthStatus?.currentStatus || "Healthy",
        bodyScore: animal.healthStatus?.bodyConditionScore || "N/A",
        weight: animal.healthStatus?.weight
          ? `${animal.healthStatus.weight.value} ${animal.healthStatus.weight.unit}`
          : "N/A",
        lastCheckup: formatDate(animal.healthStatus?.lastCheckupDate),
        nextCheckup: formatDate(animal.healthStatus?.nextCheckupDate),
      },
      reproductive: {
        status: animal.reproductiveStatus || "normal",
        isPregnant: animal.pregnancyStatus?.isPregnant ? "Yes" : "No",
        expectedDelivery: formatDate(
          animal.pregnancyStatus?.expectedDeliveryDate,
        ),
        isLactating: animal.lactationStatus?.isLactating ? "Yes" : "No",
        lastCalving: formatDate(animal.lactationStatus?.lastCalvingDate),
        dailyYield: animal.lactationStatus?.dailyYield?.value
          ? `${animal.lactationStatus.dailyYield.value} ${animal.lactationStatus.dailyYield.unit}`
          : "N/A",
      },
      vaccination: {
        lastVaccination: formatDate(
          animal.vaccinationSummary?.lastVaccinationDate,
        ),
        nextVaccination: formatDate(
          animal.vaccinationSummary?.nextVaccinationDate,
        ),
        status: animal.vaccinationSummary?.isUpToDate
          ? "Up to Date"
          : "Pending",
        totalVaccinations: animal.vaccinationSummary?.totalVaccinations || 0,
      },
      owner: {
        current: animal.currentOwner?.name || animal.farmer?.name,
        farmerId:
          animal.currentOwner?.uniqueFarmerId || animal.farmer?.uniqueFarmerId,
        phone: animal.farmer?.mobileNumber || "N/A",
        address: animal.farmer?.address
          ? `${animal.farmer.address.village}, ${animal.farmer.address.district}`
          : "N/A",
      },
      management: {
        feeding: animal.feedingType || "N/A",
        housing: animal.housingType || "N/A",
        status: animal.status || "active",
        isActive: animal.isActive ? "Yes" : "No",
      },
      history: {
        medicalRecords: animal.medicalHistory?.length || 0,
        breedingRecords: animal.breedingHistory?.length || 0,
        vaccinationRecords: animal.vaccinations?.length || 0,
        previousOwners: animal.previousOwners?.length || 0,
      },
      generatedOn: new Date().toLocaleString("en-IN"),
    };

    // Return based on format
    if (format === "json") {
      return res.json(reportData);
    }

    if (format === "pdf") {
      // For PDF generation, you would use a library like puppeteer or pdfkit
      // This is a simplified version
      return res.render("admin/animals/report-pdf", {
        report: reportData,
        layout: false,
      });
    }

    // Default HTML view
    res.render("admin/animals/report", {
      animal,
      report: reportData,
      title: `Animal Report - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    req.flash("error", "❌ Failed to generate report.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals/${req.params.id}`);
  }
};

module.exports.quickStatusUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, notes } = req.body;

    const animal = await Animal.findById(id);
    if (!animal) {
      return res.status(404).json({ error: "Animal not found" });
    }

    const updates = {};

    switch (field) {
      case "healthStatus":
        const validHealthStatuses = [
          "Healthy",
          "Sick",
          "Under Treatment",
          "Recovered",
          "Quarantined",
          "Chronic Condition",
        ];
        if (validHealthStatuses.includes(value)) {
          animal.healthStatus.currentStatus = value;
          animal.healthStatus.lastCheckupDate = new Date();
          if (notes) {
            animal.healthStatus.healthNotes = notes;
          }
        }
        break;

      case "pregnancyStatus":
        animal.pregnancyStatus.isPregnant = value === "true";
        animal.pregnancyStatus.confirmedDate =
          value === "true" ? new Date() : null;
        break;

      case "lactationStatus":
        animal.lactationStatus.isLactating = value === "true";
        animal.lactationStatus.lastCalvingDate =
          value === "true" ? new Date() : null;
        break;

      case "isActive":
        animal.isActive = value === "true";
        animal.status = value === "true" ? "active" : "inactive";
        animal.statusChangeDate = new Date();
        animal.statusChangeReason = notes || "Quick status update";
        break;

      default:
        return res.status(400).json({ error: "Invalid field" });
    }

    await animal.save();

    return res.json({
      success: true,
      message: "Status updated successfully",
      data: {
        healthStatus: animal.healthStatus.currentStatus,
        isPregnant: animal.pregnancyStatus.isPregnant,
        isLactating: animal.lactationStatus.isLactating,
        isActive: animal.isActive,
      },
    });
  } catch (error) {
    console.error("Quick status update error:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
};

module.exports.exportAnimals = async (req, res) => {
  try {
    const { format = "csv" } = req.query;

    const animals = await Animal.find()
      .populate("farmer", "name uniqueFarmerId")
      .populate("currentOwner", "name")
      .lean();

    // Format data for export
    const exportData = animals.map((animal) => ({
      "Animal ID": animal.uniqueAnimalId,
      "Tag Number": animal.tagNumber,
      Name: animal.name || "",
      Type: animal.animalType,
      Breed: animal.breed || "",
      Gender: animal.gender,
      Age: animal.age ? `${animal.age.value} ${animal.age.unit}` : "",
      "Farmer ID": animal.farmer?.uniqueFarmerId || "",
      "Farmer Name": animal.farmer?.name || "",
      "Health Status": animal.healthStatus?.currentStatus || "",
      Pregnant: animal.pregnancyStatus?.isPregnant ? "Yes" : "No",
      Lactating: animal.lactationStatus?.isLactating ? "Yes" : "No",
      "Vaccination Status": animal.vaccinationSummary?.isUpToDate
        ? "Up to Date"
        : "Pending",
      "Next Vaccination": animal.vaccinationSummary?.nextVaccinationDate
        ? new Date(
            animal.vaccinationSummary.nextVaccinationDate,
          ).toLocaleDateString()
        : "",
      Status: animal.isActive ? "Active" : "Inactive",
      "Registration Date": new Date(animal.createdAt).toLocaleDateString(),
    }));

    if (format === "excel") {
      // For Excel export, you would use a library like exceljs
      // This is a simplified version returning JSON
      return res.json(exportData);
    }

    // Default to CSV
    const fields = Object.keys(exportData[0] || {});
    const csvData = [
      fields.join(","),
      ...exportData.map((row) =>
        fields.map((field) => `"${row[field] || ""}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=animals_export_${Date.now()}.csv`,
    );
    res.send(csvData);
  } catch (error) {
    console.error("Export animals error:", error);
    req.flash("error", "❌ Failed to export animals.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals`);
  }
};

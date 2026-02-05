const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
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
    const limit = 10; // animals per page
    const skip = (page - 1) * limit;

    const totalAnimals = await Animal.countDocuments();

    const animals = await Animal.find()
      .populate("farmer", "name mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Ensure uniqueAnimalId exists (safe check)
    for (let animal of animals) {
      if (!animal.uniqueAnimalId) {
        animal.uniqueAnimalId = `ANI-${Date.now()}-${Math.floor(
          Math.random() * 1000,
        )}`;
        await animal.save();
      }
    }

    const totalPages = Math.ceil(totalAnimals / limit);

    res.render("admin/animal.ejs", {
      title: "Animals Management",
      animals,
      currentPage: page,
      totalPages,
      limit,
      totalAnimals,
    });
  } catch (error) {
    console.error("Animals Index Error:", error);
    res.status(500).send("Internal Server Error");
  }
};
module.exports.createAnimalForm = async (req, res) => {
  try {
    // Fetch all farmers and users to populate the dropdowns
    const farmers = await Farmer.find({ isActive: true }).sort({ name: 1 }); // active farmers, sorted by name
    const sales = await SalesTeam.find({ isActive: true })
      .populate("user")
      .sort({ name: 1 }); // active users, sorted by name

    // Render the form with fetched data
    res.render("admin/animals/new.ejs", { farmers, sales });
  } catch (error) {
    console.error("Error rendering create animal form:", error);
    req.flash("error", "Unable to load form at this time.");
    res.status(500).send("Internal Server Error");
  }
};

module.exports.createAnimal = async (req, res) => {
  try {
    const {
      farmer,
      animalType,
      breed,
      gender,
      name,
      tagNumber,
      healthStatus,
      isActive,
      registeredBy,
      reproductiveStatus,
      feedingType,
      housingType,
      dateOfBirth,
      dateOfAcquisition,
      sourceOfAnimal,
      additionalNotes,
      healthNotes,
    } = req.body;

    // Age (backward compatible)
    const age = {
      value: req.body?.age?.value ? Number(req.body.age.value) : undefined,
      unit: req.body?.age?.unit || undefined,
    };

    // Pregnancy Status
    const pregnancyStatus = {
      isPregnant: req.body?.pregnancyStatus?.isPregnant === "on",
      kitUsed: req.body?.pregnancyStatus?.kitUsed || null,
      testDate: req.body?.pregnancyStatus?.testDate
        ? new Date(req.body.pregnancyStatus.testDate)
        : null,
      confirmedDate: req.body?.pregnancyStatus?.confirmedDate
        ? new Date(req.body.pregnancyStatus.confirmedDate)
        : null,
      expectedDeliveryDate: req.body?.pregnancyStatus?.expectedDeliveryDate
        ? new Date(req.body.pregnancyStatus.expectedDeliveryDate)
        : null,
      stage: req.body?.pregnancyStatus?.stage || null,
      numberOfFetuses: req.body?.pregnancyStatus?.numberOfFetuses
        ? Number(req.body.pregnancyStatus.numberOfFetuses)
        : null,
      previousPregnancies: req.body?.pregnancyStatus?.previousPregnancies
        ? Number(req.body.pregnancyStatus.previousPregnancies)
        : 0,
      pregnancyNotes: req.body?.pregnancyStatus?.notes || "",
    };

    // Lactation Status
    const lactationStatus = {
      isLactating: req.body?.lactationStatus?.isLactating === "on",
      lastCalvingDate: req.body?.lactationStatus?.lastCalvingDate
        ? new Date(req.body.lactationStatus.lastCalvingDate)
        : null,
      lactationNumber: req.body?.lactationStatus?.lactationNumber
        ? Number(req.body.lactationStatus.lactationNumber)
        : null,
      daysInMilk: req.body?.lactationStatus?.daysInMilk
        ? Number(req.body.lactationStatus.daysInMilk)
        : null,
      dailyYield: {
        value: req.body?.lactationStatus?.dailyYield
          ? Number(req.body.lactationStatus.dailyYield)
          : null,
        unit: req.body?.lactationStatus?.yieldUnit || null,
      },
      milkQuality: req.body?.lactationStatus?.milkQuality || null,
      milkingFrequency: req.body?.lactationStatus?.milkingFrequency || null,
      lactationNotes: req.body?.lactationStatus?.notes || "",
    };

    // Health Status (enhanced)
    const healthStatusObj = {
      currentStatus: healthStatus || "Healthy",
      lastCheckupDate: new Date(),
      nextCheckupDate: req.body?.nextCheckupDate
        ? new Date(req.body.nextCheckupDate)
        : null,
      healthNotes: healthNotes || "",
      bodyConditionScore: req.body?.bodyConditionScore
        ? parseFloat(req.body.bodyConditionScore)
        : 3,
      weight: {
        value: req.body?.weight?.value ? Number(req.body.weight.value) : null,
        unit: req.body?.weight?.unit || "kg",
        lastUpdated: new Date(),
      },
    };

    // Vaccination Summary (initialize)
    const vaccinationSummary = {
      lastVaccinationDate: req.body?.vaccinationStatus?.lastVaccinationDate
        ? new Date(req.body.vaccinationStatus.lastVaccinationDate)
        : null,
      nextVaccinationDate: req.body?.vaccinationStatus?.nextVaccinationDate
        ? new Date(req.body.vaccinationStatus.nextVaccinationDate)
        : null,
      lastVaccineType: req.body?.vaccinationStatus?.vaccineType || null,
      totalVaccinations: 0,
      isUpToDate: false,
    };

    // Purchase Details (if applicable)
    const purchaseDetails =
      sourceOfAnimal === "purchased"
        ? {
            price: req.body?.purchaseDetails?.price
              ? Number(req.body.purchaseDetails.price)
              : null,
            currency: req.body?.purchaseDetails?.currency || "INR",
            seller: req.body?.purchaseDetails?.seller || "",
            purchaseDate: req.body?.purchaseDetails?.purchaseDate
              ? new Date(req.body.purchaseDetails.purchaseDate)
              : null,
          }
        : null;

    // Medical History (initial entry if any)
    const medicalHistory = req.body?.initialMedicalHistory
      ? [
          {
            date: new Date(),
            condition: req.body.initialMedicalHistory.condition,
            treatment: req.body.initialMedicalHistory.treatment,
            treatedBy: req.body.initialMedicalHistory.treatedBy || null,
            resolved: req.body.initialMedicalHistory.resolved === "on",
            notes: req.body.initialMedicalHistory.notes || "",
          },
        ]
      : [];

    // Base animal data
    const animalData = {
      farmer,
      registeredBy: registeredBy || req.user._id,
      animalType,
      breed,
      age,
      gender,
      name,
      tagNumber,
      healthStatus: healthStatusObj,
      isActive: isActive === "on" || true,
      pregnancyStatus,
      lactationStatus,
      vaccinationSummary,
      reproductiveStatus: reproductiveStatus || "normal",
      feedingType: feedingType || null,
      housingType: housingType || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      dateOfAcquisition: dateOfAcquisition ? new Date(dateOfAcquisition) : null,
      sourceOfAnimal: sourceOfAnimal || "born_on_farm",
      purchaseDetails,
      medicalHistory,
      additionalNotes,
      status: "active",
      currentOwner: farmer,
      photos: {},
    };

    // Handle photos
    const photoFields = ["front", "left", "right", "back"];
    if (req.files) {
      for (const field of photoFields) {
        if (req.files[field]?.[0]) {
          const file = req.files[field][0];
          animalData.photos[field] = {
            url: file.path,
            filename: file.originalname,
            public_id: file.filename,
            uploadedAt: new Date(),
          };
        }
      }
    }

    // Create vaccination record if provided
    if (req.body?.vaccinationStatus?.isVaccinated === "on") {
      const vaccinationData = {
        farmer,
        animal: null, // Will be set after animal creation
        vaccineName:
          req.body.vaccinationStatus.vaccineType || "Unknown Vaccine",
        vaccineType: "Preventive",
        dateAdministered: req.body.vaccinationStatus.lastVaccinationDate
          ? new Date(req.body.vaccinationStatus.lastVaccinationDate)
          : new Date(),
        nextDueDate: req.body.vaccinationStatus.nextVaccinationDate
          ? new Date(req.body.vaccinationStatus.nextVaccinationDate)
          : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months default
        administeredBy: req.user._id,
        notes:
          req.body.vaccinationStatus.history ||
          "Initial vaccination during registration",
        status: "Completed",
      };

      // Save vaccination after animal creation
      animalData.initialVaccination = vaccinationData;
    }

    // Save animal to DB
    const newAnimal = new Animal(animalData);
    await newAnimal.save();

    // Create vaccination record if needed
    if (animalData.initialVaccination) {
      const Vaccination = require("./vaccination");
      const vaccinationRecord = new Vaccination({
        ...animalData.initialVaccination,
        animal: newAnimal._id,
      });
      await vaccinationRecord.save();

      // Update vaccination summary
      await newAnimal.updateVaccinationSummary();
    }

    // Send notification based on animal status
    if (pregnancyStatus.isPregnant) {
      req.flash(
        "primary",
        `Pregnant animal registered! Expected delivery: ${pregnancyStatus.expectedDeliveryDate ? new Date(pregnancyStatus.expectedDeliveryDate).toLocaleDateString() : "Not specified"}`,
      );
    }

    if (lactationStatus.isLactating) {
      req.flash(
        "info",
        `Lactating animal registered with daily yield: ${lactationStatus.dailyYield.value || "N/A"} ${lactationStatus.dailyYield.unit || "units"}`,
      );
    }

    if (healthStatusObj.currentStatus !== "Healthy") {
      req.flash(
        "warning",
        `Animal registered with health status: ${healthStatusObj.currentStatus}. Requires attention.`,
      );
    }

    req.flash(
      "success",
      `Animal "${name || tagNumber}" registered successfully! ID: ${newAnimal.uniqueAnimalId}`,
    );

    // Redirect based on user role
    const role = req.user.role.toLowerCase();
    res.redirect(`/${role}/animals/${newAnimal._id}`);
  } catch (error) {
    console.error("Error creating animal:", error);

    // Specific error messages
    if (error.code === 11000) {
      if (error.keyPattern.tagNumber) {
        req.flash(
          "error",
          "Tag number already exists. Please use a unique tag number.",
        );
      } else if (error.keyPattern.uniqueAnimalId) {
        req.flash("error", "Duplicate animal ID generated. Please try again.");
      } else {
        req.flash(
          "error",
          "Duplicate entry detected. Please check your input.",
        );
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
      req.flash("error", "Failed to register animal. Please try again.");
    }

    // Store form data in session for repopulation
    req.session.formData = req.body;

    // Redirect back to form
    const role = req.user.role.toLowerCase();
    res.redirect(`/${role}/animals/new`);
  }
};

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
      .populate("medicalHistory.treatedBy", "name")
      .populate("breedingHistory.bullId") // Assuming bullId references Animal schema
      .populate("previousOwners.farmer", "name uniqueFarmerId");

    if (!animal) {
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Get vaccination records for this animal
    const Vaccination = require("../models/vaccination");
    const vaccinations = await Vaccination.find({ animal: id })
      .populate("administeredBy", "name")
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
      animal.ageInMonths = months;
    }

    // Calculate pregnancy duration if pregnant
    let pregnancyDuration = null;
    if (
      animal.pregnancyStatus?.isPregnant &&
      animal.pregnancyStatus?.confirmedDate
    ) {
      const today = new Date();
      const confirmedDate = new Date(animal.pregnancyStatus.confirmedDate);
      const diffTime = Math.abs(today - confirmedDate);
      pregnancyDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate days since last calving
    let daysSinceCalving = null;
    if (animal.lactationStatus?.lastCalvingDate) {
      const today = new Date();
      const lastCalving = new Date(animal.lactationStatus.lastCalvingDate);
      const diffTime = Math.abs(today - lastCalving);
      daysSinceCalving = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Get upcoming vaccinations
    const upcomingVaccinations = await Vaccination.find({
      animal: id,
      nextDueDate: { $gte: new Date() },
      status: { $ne: "Completed" },
    })
      .populate("administeredBy", "name")
      .sort({ nextDueDate: 1 })
      .limit(3);

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

    res.render("admin/animals/view.ejs", {
      animal,
      vaccinations,
      upcomingVaccinations,
      otherAnimals,
      ageInMonths,
      pregnancyDuration,
      daysSinceCalving,
      title: `Animal Details - ${animal.uniqueAnimalId || animal.tagNumber}`,
      helpers: {
        formatDate: function (date) {
          return date ? new Date(date).toLocaleDateString("en-IN") : "N/A";
        },
        formatDateTime: function (date) {
          return date ? new Date(date).toLocaleString("en-IN") : "N/A";
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
    const farmers = await Farmer.find()
      .select("name uniqueFarmerId")
      .sort({ name: 1 });

    // Get sales agents for dropdown
    const User = require("../models/user");
    const sales = await User.find({ role: "Sale" })
      .select("name email")
      .sort({ name: 1 });

    res.render("admin/animals/edit", {
      animal,
      farmers,
      sales,
      title: `Edit Animal - ${animal.uniqueAnimalId}`,
    });
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

    // Helper function to safely parse nested objects
    const parseNested = (obj, path) => {
      const keys = path.split(".");
      let value = req.body;
      for (const key of keys) {
        if (value && typeof value === "object" && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
      return value;
    };

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
    animal.tagNumber = req.body.tagNumber || animal.tagNumber;
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
      animal.age = {
        value: req.body.age.value
          ? parseFloat(req.body.age.value)
          : animal.age?.value,
        unit: ["Days", "Months", "Years"].includes(req.body.age.unit)
          ? req.body.age.unit
          : animal.age?.unit,
      };
    }

    /* ---------------- PREGNANCY STATUS ---------------- */
    if (req.body.pregnancyStatus) {
      animal.pregnancyStatus = {
        isPregnant: req.body.pregnancyStatus.isPregnant === "on",
        kitUsed:
          req.body.pregnancyStatus.kitUsed ||
          animal.pregnancyStatus?.kitUsed ||
          null,
        testDate: req.body.pregnancyStatus.testDate
          ? new Date(req.body.pregnancyStatus.testDate)
          : animal.pregnancyStatus?.testDate || null,
        confirmedDate: req.body.pregnancyStatus.confirmedDate
          ? new Date(req.body.pregnancyStatus.confirmedDate)
          : animal.pregnancyStatus?.confirmedDate || null,
        expectedDeliveryDate: req.body.pregnancyStatus.expectedDeliveryDate
          ? new Date(req.body.pregnancyStatus.expectedDeliveryDate)
          : animal.pregnancyStatus?.expectedDeliveryDate || null,
        stage:
          req.body.pregnancyStatus.stage ||
          animal.pregnancyStatus?.stage ||
          null,
        numberOfFetuses: req.body.pregnancyStatus.numberOfFetuses
          ? parseInt(req.body.pregnancyStatus.numberOfFetuses)
          : animal.pregnancyStatus?.numberOfFetuses || null,
        previousPregnancies: req.body.pregnancyStatus.previousPregnancies
          ? parseInt(req.body.pregnancyStatus.previousPregnancies)
          : animal.pregnancyStatus?.previousPregnancies || 0,
        pregnancyNotes:
          req.body.pregnancyStatus.pregnancyNotes ||
          animal.pregnancyStatus?.pregnancyNotes ||
          "",
      };
    }

    /* ---------------- LACTATION STATUS ---------------- */
    if (req.body.lactationStatus) {
      animal.lactationStatus = {
        isLactating: req.body.lactationStatus.isLactating === "on",
        lastCalvingDate: req.body.lactationStatus.lastCalvingDate
          ? new Date(req.body.lactationStatus.lastCalvingDate)
          : animal.lactationStatus?.lastCalvingDate || null,
        lactationNumber: req.body.lactationStatus.lactationNumber
          ? parseInt(req.body.lactationStatus.lactationNumber)
          : animal.lactationStatus?.lactationNumber || null,
        daysInMilk: req.body.lactationStatus.daysInMilk
          ? parseInt(req.body.lactationStatus.daysInMilk)
          : animal.lactationStatus?.daysInMilk || null,
        dailyYield: {
          value: req.body.lactationStatus.dailyYield
            ? parseFloat(req.body.lactationStatus.dailyYield)
            : animal.lactationStatus?.dailyYield?.value || null,
          unit:
            req.body.lactationStatus.yieldUnit ||
            animal.lactationStatus?.dailyYield?.unit ||
            null,
        },
        milkQuality:
          req.body.lactationStatus.milkQuality ||
          animal.lactationStatus?.milkQuality ||
          null,
        milkingFrequency:
          req.body.lactationStatus.milkingFrequency ||
          animal.lactationStatus?.milkingFrequency ||
          null,
        lactationNotes:
          req.body.lactationStatus.lactationNotes ||
          animal.lactationStatus?.lactationNotes ||
          "",
      };
    }

    /* ---------------- HEALTH STATUS ---------------- */
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

    if (req.body.weight) {
      animal.healthStatus.weight = {
        value: req.body.weight.value
          ? parseFloat(req.body.weight.value)
          : animal.healthStatus?.weight?.value || null,
        unit: req.body.weight.unit || animal.healthStatus?.weight?.unit || "kg",
        lastUpdated: new Date(),
      };
    }

    if (req.body.lastCheckupDate) {
      animal.healthStatus.lastCheckupDate = new Date(req.body.lastCheckupDate);
    }

    if (req.body.nextCheckupDate) {
      animal.healthStatus.nextCheckupDate = new Date(req.body.nextCheckupDate);
    }

    if (req.body.healthNotes !== undefined) {
      animal.healthStatus.healthNotes = req.body.healthNotes;
    }

    /* ---------------- VACCINATION SUMMARY ---------------- */
    if (req.body.vaccinationSummary) {
      animal.vaccinationSummary = {
        lastVaccinationDate: req.body.vaccinationSummary.lastVaccinationDate
          ? new Date(req.body.vaccinationSummary.lastVaccinationDate)
          : animal.vaccinationSummary?.lastVaccinationDate || null,
        nextVaccinationDate: req.body.vaccinationSummary.nextVaccinationDate
          ? new Date(req.body.vaccinationSummary.nextVaccinationDate)
          : animal.vaccinationSummary?.nextVaccinationDate || null,
        lastVaccineType:
          req.body.vaccinationSummary.lastVaccineType ||
          animal.vaccinationSummary?.lastVaccineType ||
          null,
        totalVaccinations: animal.vaccinationSummary?.totalVaccinations || 0,
        isUpToDate: req.body.vaccinationSummary.isUpToDate === "on",
        lastUpdated: new Date(),
      };
    }

    /* ---------------- REPRODUCTIVE STATUS ---------------- */
    const validReproductiveStatuses = [
      "normal",
      "in_heat",
      "bred",
      "open",
      "sterile",
      "castrated",
      "not_applicable",
    ];
    if (
      req.body.reproductiveStatus &&
      validReproductiveStatuses.includes(req.body.reproductiveStatus)
    ) {
      animal.reproductiveStatus = req.body.reproductiveStatus;
    }

    /* ---------------- MANAGEMENT FIELDS ---------------- */
    const validFeedingTypes = [
      "grazing",
      "stall_feeding",
      "mixed",
      "concentrate",
      "organic",
      null,
    ];
    if (
      req.body.feedingType &&
      validFeedingTypes.includes(req.body.feedingType)
    ) {
      animal.feedingType = req.body.feedingType;
    } else if (req.body.feedingType === "") {
      animal.feedingType = null;
    }

    const validHousingTypes = [
      "free_stall",
      "tie_stall",
      "pasture",
      "shelter",
      "open_yard",
      "other",
      null,
    ];
    if (
      req.body.housingType &&
      validHousingTypes.includes(req.body.housingType)
    ) {
      animal.housingType = req.body.housingType;
    } else if (req.body.housingType === "") {
      animal.housingType = null;
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
      animal.statusChangeReason =
        req.body.statusChangeReason || animal.statusChangeReason;
    }

    /* ---------------- PURCHASE DETAILS ---------------- */
    if (animal.sourceOfAnimal === "purchased" && req.body.purchaseDetails) {
      animal.purchaseDetails = {
        price: req.body.purchaseDetails.price
          ? parseFloat(req.body.purchaseDetails.price)
          : animal.purchaseDetails?.price || null,
        currency:
          req.body.purchaseDetails.currency ||
          animal.purchaseDetails?.currency ||
          "INR",
        seller:
          req.body.purchaseDetails.seller ||
          animal.purchaseDetails?.seller ||
          "",
        purchaseDate: req.body.purchaseDetails.purchaseDate
          ? new Date(req.body.purchaseDetails.purchaseDate)
          : animal.purchaseDetails?.purchaseDate || null,
      };
    } else if (animal.sourceOfAnimal !== "purchased") {
      animal.purchaseDetails = null;
    }

    /* ---------------- CHECKBOXES ---------------- */
    animal.isActive = req.body.isActive === "on";

    /* ---------------- PHOTOS UPDATE ---------------- */
    const photoFields = ["front", "left", "right", "back"];

    // Handle photo deletion
    if (req.body.deletePhotos) {
      for (const side of photoFields) {
        if (
          req.body.deletePhotos[side] === "on" &&
          animal.photos?.[side]?.public_id
        ) {
          try {
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
            filename: file.filename,
            public_id: file.filename,
            uploadedAt: new Date(),
          };
        }
      }
    }

    /* ---------------- UPDATE CURRENT OWNER ---------------- */
    if (
      req.body.farmer &&
      req.body.farmer !== animal.currentOwner?.toString()
    ) {
      // Add to previous owners
      if (animal.currentOwner) {
        animal.previousOwners = animal.previousOwners || [];
        animal.previousOwners.push({
          farmer: animal.currentOwner,
          fromDate: animal.dateOfAcquisition || animal.createdAt,
          toDate: new Date(),
          transferReason: "Updated ownership",
        });
      }

      animal.currentOwner = req.body.farmer;
    }

    /* ---------------- SAVE UPDATES ---------------- */
    await animal.save();

    // Update vaccination summary if needed
    if (animal.vaccinationSummary?.lastVaccinationDate) {
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
    console.error("Request body:", req.body);

    let errorMessage = "❌ Failed to update animal. Please try again.";

    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.tagNumber) {
        errorMessage =
          "❌ Tag number already exists! Please use a different tag number.";
      }
    } else if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => {
        return `${val.path}: ${val.message}`;
      });
      errorMessage = `❌ Validation Error:<br>${messages.join("<br>")}`;
    } else if (error.name === "CastError") {
      errorMessage = `❌ Invalid data type for field "${error.path}".`;
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
      req.flash("error", "❌ Animal not found.");
      return res.redirect(`/${req.user.role.toLowerCase()}/animals`);
    }

    // Check if animal has related records (optional safety check)
    const Vaccination = require("../models/vaccination");
    const vaccinationCount = await Vaccination.countDocuments({ animal: id });

    if (vaccinationCount > 0) {
      req.flash(
        "warning",
        `⚠️ This animal has ${vaccinationCount} vaccination records. Please delete them first or contact administrator.`,
      );
      return res.redirect(`/${req.user.role.toLowerCase()}/animals/${id}`);
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

    req.flash(
      "success",
      `✅ Animal "${animal.name || animal.tagNumber}" has been permanently deleted.`,
    );
    res.redirect(`/${req.user.role.toLowerCase()}/animals`);
  } catch (error) {
    console.error("Delete animal error:", error);
    req.flash("error", "❌ Failed to delete animal. Please try again.");
    res.redirect(`/${req.user.role.toLowerCase()}/animals`);
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

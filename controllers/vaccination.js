const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const Vaccine = require("../models/vaccine");
const Vaccination = require("../models/vaccination");
const mongoose = require("mongoose");
const crypto = require("crypto");

// controllers/vaccinationController.js
exports.vaccinationindex = async (req, res) => {
  try {
    const {
      search,
      status,
      vaccineType,
      animalType,
      page = 1,
      limit = 10,
    } = req.query;

    // Build query
    let query = {};
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    let twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    // Status filter
    if (status === "today") {
      query.dateAdministered = {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    } else if (status === "week") {
      query.dateAdministered = {
        $gte: today,
        $lt: weekFromNow,
      };
    } else if (status === "upcoming") {
      query.dateAdministered = {
        $gte: weekFromNow,
        $lt: twoWeeksFromNow,
      };
    } else if (status === "overdue") {
      query.nextDueDate = { $lt: today };
      query.status = { $ne: "Completed" };
    } else if (status === "blocked") {
      // Find animals that are pregnant in month 6-9
      const blockedAnimals = await Animal.find({
        isPregnant: true,
        pregnancyMonth: { $gte: 6, $lte: 9 },
      }).select("_id");

      query.animal = { $in: blockedAnimals.map((a) => a._id) };

      // Also filter for HS-BQ and Deworming vaccines
      const blockedVaccines = await Vaccine.find({
        $or: [
          { name: { $regex: "hs", $options: "i" } },
          { name: { $regex: "bq", $options: "i" } },
          { diseaseTarget: { $regex: "deworm", $options: "i" } },
        ],
      }).select("_id");

      query.vaccine = { $in: blockedVaccines.map((v) => v._id) };
    }

    // Vaccine type filter
    if (vaccineType) {
      query.vaccine = vaccineType;
    }

    // Search filter
    if (search) {
      // First find matching animals and farmers

      const matchingAnimals = await Animal.find({
        $or: [
          { tagId: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const matchingFarmers = await Farmer.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { village: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      query.$or = [
        { animal: { $in: matchingAnimals.map((a) => a._id) } },
        { farmer: { $in: matchingFarmers.map((f) => f._id) } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Animal type filter
    if (animalType && animalType !== "pregnant") {
      const matchingAnimals = await Animal.find({ species: animalType }).select(
        "_id",
      );
      query.animal = { $in: matchingAnimals.map((a) => a._id) };
    } else if (animalType === "pregnant") {
      const pregnantAnimals = await Animal.find({ isPregnant: true }).select(
        "_id",
      );
      query.animal = { $in: pregnantAnimals.map((a) => a._id) };
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get vaccinations with populated data
    const [vaccinations, total] = await Promise.all([
      Vaccination.find(query)
        .populate(
          "animal",
          "name tagId species gender isPregnant pregnancyMonth",
        )
        .populate("farmer", "name village")
        .populate("vaccine", "name brand diseaseTarget")
        .populate("administeredBy", "name")
        .sort({ dateAdministered: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Vaccination.countDocuments(query),
    ]);

    // Get stats
    const stats = await getVaccinationStats();

    // Get vaccine types for filter dropdown
    const vaccineTypes = await Vaccine.find({ isActive: true })
      .select("name brand diseaseTarget")
      .sort({ name: 1 });

    // Build query string for pagination
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (status) queryParams.set("status", status);
    if (vaccineType) queryParams.set("vaccineType", vaccineType);
    if (animalType) queryParams.set("animalType", animalType);
    const queryString = queryParams.toString()
      ? "&" + queryParams.toString()
      : "";

    res.render("admin/vaccinations/index.ejs", {
      title: "Vaccination Management",
      farmName: "abcd",
      vaccinations,
      stats,
      vaccineTypes,
      search: search || "",
      status: status || "",
      vaccineType: vaccineType || "",
      animalType: animalType || "",
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      startIndex: skip,
      queryString,
      user: req.user,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error", "Error loading vaccination dashboard");
    res.redirect("/");
  }
};

async function getVaccinationStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const [
    totalAnimals,
    pregnantAnimals,
    todayTasks,
    weekTasks,
    upcomingTasks,
    blockedTasks,
  ] = await Promise.all([
    Animal.countDocuments({ isActive: true }),
    Animal.countDocuments({ isPregnant: true }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: today, $lt: tomorrow },
      status: { $ne: "Completed" },
    }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: today, $lt: weekFromNow },
      status: { $ne: "Completed" },
    }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: weekFromNow, $lt: twoWeeksFromNow },
      status: { $ne: "Completed" },
    }),
    // Blocked due to pregnancy
    (async () => {
      const blockedAnimals = await Animal.find({
        isPregnant: true,
        pregnancyMonth: { $gte: 6, $lte: 9 },
      }).select("_id");

      const blockedVaccines = await Vaccine.find({
        $or: [
          { name: { $regex: "hs", $options: "i" } },
          { name: { $regex: "bq", $options: "i" } },
          { diseaseTarget: { $regex: "deworm", $options: "i" } },
        ],
      }).select("_id");

      return Vaccination.countDocuments({
        animal: { $in: blockedAnimals.map((a) => a._id) },
        vaccine: { $in: blockedVaccines.map((v) => v._id) },
        status: { $ne: "Completed" },
      });
    })(),
  ]);

  return {
    totalAnimals,
    pregnantAnimals,
    todayTasks,
    weekTasks,
    upcomingTasks,
    blockedTasks,
    annualVaccinationsPerAnimal: 3, // Based on Maharashtra protocol
  };
}

// controllers/vaccinationController.js (add these new methods)

// ================ RENDER NEW FORM ================
exports.renderNewForm = async (req, res) => {
  try {
    const { animalId, farmerId, batch } = req.query;

    // Get all active vaccines for dropdown
    const vaccines = await Vaccine.find({ isActive: true })
      .select(
        "name brand vaccineType diseaseTarget defaultNextDueMonths dosageUnit standardDosage administrationRoute",
      )
      .sort({ name: 1 });

    // Get farmers for dropdown (if not pre-selected)
    let farmers = [];
    if (!farmerId) {
      farmers = await Farmer.find({ isActive: true })
        .select("name village uniqueFarmerId")
        .sort({ name: 1 });
    }

    // Get animals for dropdown
    let query = { isActive: true };
    if (animalId) query._id = animalId;
    if (farmerId) query.farmer = farmerId;

    const animals = await Animal.find(query)
      .select("name tagId species uniqueAnimalId")
      .populate("farmer", "name")
      .sort({ name: 1 });

    // If batch registration, get pre-selected data
    let batchData = null;
    if (batch === "true" && req.session.bulkVaccinationData) {
      batchData = req.session.bulkVaccinationData;
      // Clear from session after retrieving
      delete req.session.bulkVaccinationData;
    }

    res.render("admin/vaccinations/new", {
      title: "New Vaccination Record",
      farmName: "abcd",
      vaccines,
      farmers,
      animals,
      batchData,
      preSelectedAnimal: animalId,
      preSelectedFarmer: farmerId,
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering new form:", error);
    req.flash("error", "Error loading form");
    res.redirect("/admin/vaccinations");
  }
};

// ================ ADD NEW VACCINATION ================
exports.addVaccination = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vaccinationData = req.body;
    const userId = req.user._id;

    // Handle single or multiple vaccinations
    let vaccinations = [];

    if (vaccinationData.isBulk && vaccinationData.animals) {
      // Bulk registration for multiple animals
      const animals = Array.isArray(vaccinationData.animals)
        ? vaccinationData.animals
        : [vaccinationData.animals];

      const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      for (let i = 0; i < animals.length; i++) {
        const animal = await Animal.findById(animals[i]).session(session);
        if (!animal) continue;

        vaccinations.push({
          farmer: animal.farmer,
          animal: animal._id,
          vaccine: vaccinationData.vaccine,
          vaccineName: vaccinationData.vaccineName,
          vaccineType: vaccinationData.vaccineType,
          batchNumber: vaccinationData.batchNumber,
          expiryDate: vaccinationData.expiryDate,
          doseNumber: vaccinationData.doseNumber || 1,
          totalDosesRequired: vaccinationData.totalDosesRequired || 1,
          administrationMethod: vaccinationData.administrationMethod,
          injectionSite: vaccinationData.injectionSite,
          dosageAmount: vaccinationData.dosageAmount,
          dosageUnit: vaccinationData.dosageUnit,
          dateAdministered: vaccinationData.dateAdministered || new Date(),
          nextDueDate: vaccinationData.nextDueDate,
          administeredBy: vaccinationData.administeredBy || req.user.name,
          verifiedBy: userId,
          animalCondition: {
            temperature: vaccinationData.temperature,
            weight: vaccinationData.weight,
            bodyConditionScore: vaccinationData.bodyConditionScore,
            isPregnant: vaccinationData.isPregnant,
            isLactating: vaccinationData.isLactating,
            healthNotes: vaccinationData.healthNotes,
          },
          notes: vaccinationData.notes,
          status: "Administered",
          verificationStatus: "Verified",
          source: "bulk_registration",
          registrationBatchId: batchId,
          registrationBatchIndex: i,
          createdBy: userId,
        });
      }
    } else {
      // Single vaccination
      vaccinations.push({
        farmer: vaccinationData.farmer,
        animal: vaccinationData.animal,
        vaccine: vaccinationData.vaccine,
        vaccineName: vaccinationData.vaccineName,
        vaccineType: vaccinationData.vaccineType,
        batchNumber: vaccinationData.batchNumber,
        expiryDate: vaccinationData.expiryDate,
        doseNumber: vaccinationData.doseNumber || 1,
        totalDosesRequired: vaccinationData.totalDosesRequired || 1,
        administrationMethod: vaccinationData.administrationMethod,
        injectionSite: vaccinationData.injectionSite,
        dosageAmount: vaccinationData.dosageAmount,
        dosageUnit: vaccinationData.dosageUnit,
        dateAdministered: vaccinationData.dateAdministered || new Date(),
        nextDueDate: vaccinationData.nextDueDate,
        administeredBy: vaccinationData.administeredBy || req.user.name,
        verifiedBy: userId,
        animalCondition: {
          temperature: vaccinationData.temperature,
          weight: vaccinationData.weight,
          bodyConditionScore: vaccinationData.bodyConditionScore,
          isPregnant: vaccinationData.isPregnant,
          isLactating: vaccinationData.isLactating,
          healthNotes: vaccinationData.healthNotes,
        },
        hadAdverseReaction: vaccinationData.hadAdverseReaction === "on",
        adverseReactionDetails: vaccinationData.adverseReactionDetails,
        reactionSeverity: vaccinationData.reactionSeverity,
        notes: vaccinationData.notes,
        followUpInstructions: vaccinationData.followUpInstructions,
        status: "Administered",
        verificationStatus: "Verified",
        source: vaccinationData.source || "manual_entry",
        createdBy: userId,
      });
    }

    // Save all vaccinations
    const savedVaccinations = await Vaccination.insertMany(vaccinations, {
      session,
    });

    await session.commitTransaction();
    session.endSession();

    // Update animal's last vaccination date
    for (const vac of savedVaccinations) {
      await Animal.findByIdAndUpdate(vac.animal, {
        lastVaccinationDate: vac.dateAdministered,
        $push: { vaccinationHistory: vac._id },
      });
    }

    req.flash(
      "success",
      `${savedVaccinations.length} vaccination record(s) saved successfully`,
    );

    if (savedVaccinations.length > 1) {
      res.redirect(
        `/admin/vaccinations/batch/${savedVaccinations[0].registrationBatchId}`,
      );
    } else {
      res.redirect(`/admin/vaccinations/${savedVaccinations[0]._id}`);
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error saving vaccination:", error);
    req.flash("error", "Error saving vaccination record");
    res.redirect("/admin/vaccinations/new");
  }
};

// ================ RENDER EDIT FORM ================
exports.renderEditForm = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id)
      .populate("animal", "name tagId species")
      .populate("farmer", "name village")
      .populate("vaccine", "name brand vaccineType");

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/admin/vaccinations");
    }

    const vaccines = await Vaccine.find({ isActive: true })
      .select("name brand vaccineType")
      .sort({ name: 1 });

    res.render("admin/vaccinations/edit", {
      title: "Edit Vaccination Record",
      farmName: "abcd",
      vaccination,
      vaccines,
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering edit form:", error);
    req.flash("error", "Error loading edit form");
    res.redirect("/admin/vaccinations");
  }
};

// ================ UPDATE VACCINATION ================
exports.updateVaccination = async (req, res) => {
  try {
    const vaccinationId = req.params.id;
    const updateData = req.body;
    const userId = req.user._id;

    // Prepare update object
    const update = {
      vaccine: updateData.vaccine,
      vaccineName: updateData.vaccineName,
      vaccineType: updateData.vaccineType,
      batchNumber: updateData.batchNumber,
      expiryDate: updateData.expiryDate,
      doseNumber: updateData.doseNumber,
      totalDosesRequired: updateData.totalDosesRequired,
      administrationMethod: updateData.administrationMethod,
      injectionSite: updateData.injectionSite,
      dosageAmount: updateData.dosageAmount,
      dosageUnit: updateData.dosageUnit,
      dateAdministered: updateData.dateAdministered,
      nextDueDate: updateData.nextDueDate,
      administeredBy: updateData.administeredBy,
      animalCondition: {
        temperature: updateData.temperature,
        weight: updateData.weight,
        bodyConditionScore: updateData.bodyConditionScore,
        isPregnant: updateData.isPregnant === "on",
        isLactating: updateData.isLactating === "on",
        healthNotes: updateData.healthNotes,
      },
      hadAdverseReaction: updateData.hadAdverseReaction === "on",
      adverseReactionDetails: updateData.adverseReactionDetails,
      reactionSeverity: updateData.reactionSeverity,
      notes: updateData.notes,
      followUpInstructions: updateData.followUpInstructions,
      status: updateData.status,
      verificationStatus: updateData.verificationStatus,
      verificationNotes: updateData.verificationNotes,
      updatedBy: userId,
    };

    // Check if series is complete
    if (update.doseNumber === update.totalDosesRequired) {
      update.isSeriesComplete = true;
      update.seriesCompletionDate = new Date();
    }

    const vaccination = await Vaccination.findByIdAndUpdate(
      vaccinationId,
      update,
      { new: true, runValidators: true },
    );

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/admin/vaccinations");
    }

    req.flash("success", "Vaccination record updated successfully");
    res.redirect(`/admin/vaccinations/${vaccinationId}`);
  } catch (error) {
    console.error("Error updating vaccination:", error);
    req.flash("error", "Error updating vaccination record");
    res.redirect(`/admin/vaccinations/${req.params.id}/edit`);
  }
};

// ================ VIEW VACCINATION DETAILS ================
exports.viewVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id)
      .populate(
        "animal",
        "name tagId species gender dateOfBirth uniqueAnimalId",
      )
      .populate("farmer", "name village uniqueFarmerId phone")
      .populate("vaccine", "name brand manufacturer diseaseTarget")
      .populate("verifiedBy", "name email")
      .populate("createdBy", "name")
      .populate("updatedBy", "name");

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/admin/vaccinations");
    }

    // Get previous vaccinations for this animal with same vaccine
    const previousVaccinations = await Vaccination.find({
      animal: vaccination.animal._id,
      vaccine: vaccination.vaccine?._id,
      _id: { $ne: vaccination._id },
      status: { $in: ["Administered", "Completed"] },
    })
      .sort({ dateAdministered: -1 })
      .limit(5)
      .populate("vaccine", "name");

    res.render("admin/vaccinations/view", {
      title: "Vaccination Details",
      farmName: "abcd",
      vaccination,
      previousVaccinations,
      user: req.user,
    });
  } catch (error) {
    console.error("Error viewing vaccination:", error);
    req.flash("error", "Error loading vaccination details");
    res.redirect("/admin/vaccinations");
  }
};

// ================ VERIFY STATUS ================
exports.verifyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    const vaccination = await Vaccination.findByIdAndUpdate(
      id,
      {
        verificationStatus,
        verificationNotes,
        verifiedBy: req.user._id,
        updatedBy: req.user._id,
      },
      { new: true },
    );

    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    req.flash(
      "success",
      `Vaccination record ${verificationStatus.toLowerCase()} successfully`,
    );

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        message: `Record ${verificationStatus.toLowerCase()} successfully`,
        verificationStatus: vaccination.verificationStatus,
      });
    }

    res.redirect(`/admin/vaccinations/${id}`);
  } catch (error) {
    console.error("Error verifying vaccination:", error);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Error updating verification status",
        });
    }

    req.flash("error", "Error updating verification status");
    res.redirect(`/admin/vaccinations/${req.params.id}`);
  }
};

// ================ DELETE VACCINATION ================
exports.deleteVaccination = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vaccination = await Vaccination.findById(req.params.id).session(
      session,
    );

    if (!vaccination) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    // Remove reference from animal
    await Animal.findByIdAndUpdate(
      vaccination.animal,
      { $pull: { vaccinationHistory: vaccination._id } },
      { session },
    );

    // Delete the vaccination record
    await vaccination.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    req.flash("success", "Vaccination record deleted successfully");

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        message: "Record deleted successfully",
      });
    }

    res.redirect("/admin/vaccinations");
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting vaccination:", error);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res
        .status(500)
        .json({ success: false, message: "Error deleting record" });
    }

    req.flash("error", "Error deleting vaccination record");
    res.redirect("/admin/vaccinations");
  }
};

// ================ VIEW BATCH DETAILS ================
exports.viewBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const vaccinations = await Vaccination.find({
      registrationBatchId: batchId,
    })
      .populate("animal", "name tagId species")
      .populate("farmer", "name village")
      .populate("vaccine", "name brand")
      .populate("createdBy", "name")
      .sort({ registrationBatchIndex: 1 });

    if (!vaccinations.length) {
      req.flash("error", "Batch not found");
      return res.redirect("/admin/vaccinations");
    }

    res.render("admin/vaccinations/batch", {
      title: "Batch Vaccination Details",
      farmName: "abcd",
      vaccinations,
      batchId,
      user: req.user,
    });
  } catch (error) {
    console.error("Error viewing batch:", error);
    req.flash("error", "Error loading batch details");
    res.redirect("/admin/vaccinations");
  }
};

// ================ GET ANIMALS BY FARMER (AJAX) ================
exports.getAnimalsByFarmer = async (req, res) => {
  try {
    const { farmerId } = req.params;

    const animals = await Animal.find({
      farmer: farmerId,
      isActive: true,
    }).select("name tagId species");

    res.json({ success: true, animals });
  } catch (error) {
    console.error("Error fetching animals:", error);
    res.status(500).json({ success: false, message: "Error fetching animals" });
  }
};

// ================ GET VACCINE DETAILS (AJAX) ================
exports.getVaccineDetails = async (req, res) => {
  try {
    const { vaccineId } = req.params;

    const vaccine = await Vaccine.findById(vaccineId).select(
      "name brand vaccineType defaultNextDueMonths dosageUnit standardDosage administrationRoute",
    );

    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    res.json({ success: true, vaccine });
  } catch (error) {
    console.error("Error fetching vaccine details:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching vaccine details" });
  }
};

// ================ CALCULATE NEXT DUE DATE (AJAX) ================
exports.calculateNextDueDate = async (req, res) => {
  try {
    const { vaccineId, dateAdministered } = req.body;

    const vaccine = await Vaccine.findById(vaccineId);
    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    const adminDate = new Date(dateAdministered);
    let nextDueDate = new Date(adminDate);

    if (vaccine.defaultNextDueMonths) {
      nextDueDate.setMonth(
        nextDueDate.getMonth() + vaccine.defaultNextDueMonths,
      );
    } else if (vaccine.boosterIntervalWeeks) {
      nextDueDate.setDate(
        nextDueDate.getDate() + vaccine.boosterIntervalWeeks * 7,
      );
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }

    res.json({
      success: true,
      nextDueDate: nextDueDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error calculating next due date:", error);
    res
      .status(500)
      .json({ success: false, message: "Error calculating next due date" });
  }
};

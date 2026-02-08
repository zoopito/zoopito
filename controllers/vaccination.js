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

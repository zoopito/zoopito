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

// @desc    Render vaccine form (for create/edit)
// @route   GET /vaccines/new
// @route   GET /vaccines/:id/edit
exports.renderVaccineForm = async (req, res) => {
  try {
    let vaccine = null;
    const isEdit = req.params.id;

    if (isEdit) {
      vaccine = await Vaccine.findById(req.params.id);
      if (!vaccine) {
        req.flash("error", "Vaccine not found");
        return res.redirect("/vaccines");
      }
    }

    // Options for dropdowns
    const vaccineTypes = [
      "Live Attenuated",
      "Inactivated",
      "Toxoid",
      "Subunit",
      "Conjugate",
      "mRNA",
      "Other",
    ];
    const categories = [
      "Core",
      "Non-Core",
      "Optional",
      "Seasonal",
      "Emergency",
    ];
    const species = [
      "Cattle",
      "Sheep",
      "Goat",
      "Pig",
      "Chicken",
      "Dog",
      "Cat",
      "Horse",
      "All",
    ];
    const routes = [
      "Subcutaneous",
      "Intramuscular",
      "Oral",
      "Nasal",
      "Ocular",
      "Intradermal",
      "Topical",
    ];
    const units = ["ml", "dose", "tablet", "drop", "spray"];

    res.render("vaccines/form", {
      title: isEdit ? "Edit Vaccine" : "Add New Vaccine",
      vaccine,
      isEdit,
      vaccineTypes,
      categories,
      species,
      routes,
      units,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error loading form");
    res.redirect("/vaccines");
  }
};

// @desc    Create new vaccine
// @route   POST /vaccines
exports.createVaccine = async (req, res) => {
  try {
    // Process array fields
    if (req.body.targetSpecies && !Array.isArray(req.body.targetSpecies)) {
      req.body.targetSpecies = [req.body.targetSpecies];
    }
    if (req.body.approvedSpecies && !Array.isArray(req.body.approvedSpecies)) {
      req.body.approvedSpecies = [req.body.approvedSpecies];
    }

    // Add creator info
    req.body.createdBy = req.user._id;
    req.body.updatedBy = req.user._id;

    const vaccine = new Vaccine(req.body);
    await vaccine.save();

    req.flash("success", "Vaccine created successfully");
    res.redirect(`/vaccines/${vaccine._id}`);
  } catch (error) {
    console.error(error);

    // Handle duplicate key error
    if (error.code === 11000) {
      req.flash("error", "A vaccine with this name already exists");
    } else {
      req.flash("error", "Error creating vaccine");
    }

    // Redirect back with form data
    const vaccineTypes = [
      "Live Attenuated",
      "Inactivated",
      "Toxoid",
      "Subunit",
      "Conjugate",
      "mRNA",
      "Other",
    ];
    const categories = [
      "Core",
      "Non-Core",
      "Optional",
      "Seasonal",
      "Emergency",
    ];
    const species = [
      "Cattle",
      "Sheep",
      "Goat",
      "Pig",
      "Chicken",
      "Dog",
      "Cat",
      "Horse",
      "All",
    ];
    const routes = [
      "Subcutaneous",
      "Intramuscular",
      "Oral",
      "Nasal",
      "Ocular",
      "Intradermal",
      "Topical",
    ];
    const units = ["ml", "dose", "tablet", "drop", "spray"];

    res.render("vaccines/form", {
      title: "Add New Vaccine",
      vaccine: req.body,
      isEdit: false,
      vaccineTypes,
      categories,
      species,
      routes,
      units,
    });
  }
};

// @desc    Update vaccine
// @route   PUT /vaccines/:id
exports.updateVaccine = async (req, res) => {
  try {
    // Process array fields
    if (req.body.targetSpecies && !Array.isArray(req.body.targetSpecies)) {
      req.body.targetSpecies = [req.body.targetSpecies];
    }
    if (req.body.approvedSpecies && !Array.isArray(req.body.approvedSpecies)) {
      req.body.approvedSpecies = [req.body.approvedSpecies];
    }

    // Add updater info
    req.body.updatedBy = req.user._id;
    req.body.updatedAt = Date.now();

    const vaccine = await Vaccine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!vaccine) {
      req.flash("error", "Vaccine not found");
      return res.redirect("/vaccines");
    }

    req.flash("success", "Vaccine updated successfully");
    res.redirect(`/vaccines/${vaccine._id}`);
  } catch (error) {
    console.error(error);

    // Handle duplicate key error
    if (error.code === 11000) {
      req.flash("error", "A vaccine with this name already exists");
    } else {
      req.flash("error", "Error updating vaccine");
    }

    res.redirect(`/vaccines/${req.params.id}/edit`);
  }
};

// @desc    Get single vaccine
// @route   GET /vaccines/:id
exports.getVaccine = async (req, res) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!vaccine) {
      req.flash("error", "Vaccine not found");
      return res.redirect("/vaccines");
    }

    res.render("vaccines/show.ejs", {
      title: vaccine.name,
      vaccine,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error fetching vaccine details");
    res.redirect("/vaccines");
  }
};

// @desc    Get all vaccines
// @route   GET /vaccines
exports.getAllVaccines = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, species, category, isActive } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { diseaseTarget: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    if (species && species !== "All") {
      query.targetSpecies = species;
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (isActive === "true" || isActive === "false") {
      query.isActive = isActive === "true";
    }

    // Execute query
    const [vaccines, total] = await Promise.all([
      Vaccine.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name"),
      Vaccine.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Options for filters
    const speciesOptions = [
      "All",
      "Cattle",
      "Sheep",
      "Goat",
      "Pig",
      "Chicken",
      "Dog",
      "Cat",
      "Horse",
    ];
    const categoryOptions = [
      "All",
      "Core",
      "Non-Core",
      "Optional",
      "Seasonal",
      "Emergency",
    ];

    res.render("vaccines/view.ejs", {
      title: "Vaccines",
      vaccines,
      currentPage: page,
      totalPages,
      total,
      search: search || "",
      species: species || "All",
      category: category || "All",
      isActive: isActive || "",
      speciesOptions,
      categoryOptions,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error fetching vaccines");
    res.render("vaccines/index", {
      title: "Vaccines",
      vaccines: [],
      currentPage: 1,
      totalPages: 0,
      total: 0,
    });
  }
};

// @desc    Toggle vaccine active status
// @route   PATCH /vaccines/:id/toggle-active
exports.toggleActive = async (req, res) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    vaccine.isActive = !vaccine.isActive;
    vaccine.updatedBy = req.user._id;
    await vaccine.save();

    res.json({
      success: true,
      isActive: vaccine.isActive,
      message: `Vaccine ${vaccine.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error updating vaccine status" });
  }
};

// @desc    Delete vaccine (soft delete)
// @route   DELETE /vaccines/:id
exports.deleteVaccine = async (req, res) => {
  try {
    const usedCount = await Vaccination.countDocuments({
      vaccine: req.params.id,
    });

    if (usedCount > 0) {
      req.flash(
        "error",
        `Cannot delete vaccine. It has been used in ${usedCount} vaccination records.`,
      );
      return res.redirect(`/vaccines/${req.params.id}`);
    }

    await Vaccine.findByIdAndDelete(req.params.id);

    req.flash("success", "Vaccine deleted successfully");
    res.redirect("/vaccines");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error deleting vaccine");
    res.redirect(`/vaccines/${req.params.id}`);
  }
};

// @desc    Get vaccines for dropdown (API)
// @route   GET /api/vaccines
exports.getVaccinesForDropdown = async (req, res) => {
  try {
    const { species } = req.query;

    let query = { isActive: true };
    if (species) {
      query.$or = [{ targetSpecies: species }, { targetSpecies: "All" }];
    }

    const vaccines = await Vaccine.find(query)
      .select("name brand diseaseTarget category")
      .sort({ name: 1 });

    res.json({ success: true, data: vaccines });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching vaccines" });
  }
};

const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
const crypto = require("crypto");

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
    // console.log("FILES:", req.files);
    // console.log("BODY:", req.body);
    const {
      farmer,
      animalType,
      breed,
      gender,
      name,
      tagNumber,
      healthStatus,
      isActive,
    } = req.body;

    // Age (nested safely)
    const age = {
      value: req.body?.age?.value ? Number(req.body.age.value) : undefined,
      unit: req.body?.age?.unit || undefined,
    };

    // Lactation status (nested safely)
    const lactationStatus = {
      isLactating:
        req.body?.lactationStatus?.isLactating === "on" ||
        req.body?.lactationStatus?.isLactating === true,
      lastCalvingDate: req.body?.lactationStatus?.lastCalvingDate || undefined,
      dailyYield: req.body?.lactationStatus?.dailyYield
        ? Number(req.body.lactationStatus.dailyYield)
        : undefined,
      yieldUnit: req.body?.lactationStatus?.yieldUnit || undefined,
    };

    // Generate unique animal ID ONCE
    const uniqueAnimalId = await generateAnimaleID();

    // Base animal data
    const animalData = {
      farmer,
      registeredBy: req.user._id, // always safer from session
      animalType,
      breed,
      age,
      gender,
      name,
      tagNumber,
      healthStatus: healthStatus || "Healthy",
      isActive: isActive === "on",
      uniqueAnimalId,
      lactationStatus,
      photos: {},
    };

    const photoFields = ["front", "left", "right", "back"];

    animalData.photos = {};

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

    // Save to DB
    const newAnimal = new Animal(animalData);
    await newAnimal.save();

    req.flash("success", "Animal registered successfully!");
    res.redirect("/admin/animals");
  } catch (error) {
    console.error("Error creating animal:", error);
    req.flash("error", "Failed to register animal. Please try again.");
    res.redirect("/admin/animals/new");
  }
};

module.exports.viewAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch animal and populate farmer & registeredBy
    const animal = await Animal.findById(id)
      .populate("farmer", "name mobile address")
      .populate("registeredBy", "name email");
    // console.log("Fetched Animal:", animal);
    if (!animal) {
      req.flash("error", "Animal not found.");
      return res.redirect("/admin/animals");
    }

    res.render("admin/animals/view.ejs", {
      animal,
      title: `Animal Details - ${animal.uniqueAnimalId}`,
    });
  } catch (error) {
    console.error("Error fetching animal:", error);
    req.flash("error", "Unable to fetch animal details.");
    res.redirect("/admin/animals");
  }
};

module.exports.renderEditForm = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id)
      .populate("farmer")
      .populate("registeredBy");

    if (!animal) {
      req.flash("error", "Animal not found");
      return res.redirect("/admin/animals");
    }

    const farmers = await Farmer.find({ isActive: true });
    const sales = await User.find({ role: "SALES" });

    res.render("admin/animals/edit", {
      animal,
      farmers,
      sales,
    });
  } catch (error) {
    console.error("Error rendering animal edit form:", error);
    req.flash("error", "Unable to load animal edit page");
    res.redirect("/admin/animals");
  }
};

module.exports.updateAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    let animal = await Animal.findById(id);
    if (!animal) {
      req.flash("error", "Animal not found");
      return res.redirect("/admin/animals");
    }

    /* ---------------- BASIC FIELDS ---------------- */
    animal.farmer = req.body.farmer || animal.farmer;
    animal.registeredBy = req.body.registeredBy || animal.registeredBy;

    if (
      [
        "Cow",
        "Buffalo",
        "Goat",
        "Sheep",
        "Dog",
        "Cat",
        "Poultry",
        "Other",
      ].includes(req.body.animalType)
    ) {
      animal.animalType = req.body.animalType;
    }

    animal.breed = req.body.breed || animal.breed;

    if (["Male", "Female", "Unknown"].includes(req.body.gender)) {
      animal.gender = req.body.gender;
    }

    animal.name = req.body.name || animal.name;
    animal.tagNumber = req.body.tagNumber || animal.tagNumber;

    if (
      ["Healthy", "Sick", "Under Treatment", "Recovered"].includes(
        req.body.healthStatus,
      )
    ) {
      animal.healthStatus = req.body.healthStatus;
    }

    /* ---------------- AGE ---------------- */
    if (req.body.age) {
      animal.age = {
        value: req.body.age.value || animal.age?.value,
        unit: ["Days", "Months", "Years"].includes(req.body.age.unit)
          ? req.body.age.unit
          : animal.age?.unit,
      };
    }

    /* ---------------- CHECKBOXES ---------------- */
    animal.isActive = req.body.isActive === "on";

    if (req.body.lactationStatus) {
      animal.lactationStatus = {
        isLactating: req.body.lactationStatus.isLactating === "on",
        lastCalvingDate:
          req.body.lactationStatus.lastCalvingDate ||
          animal.lactationStatus?.lastCalvingDate ||
          null,
        dailyYield:
          req.body.lactationStatus.dailyYield ||
          animal.lactationStatus?.dailyYield ||
          null,
        yieldUnit:
          req.body.lactationStatus.yieldUnit ||
          animal.lactationStatus?.yieldUnit ||
          null,
      };
    }

    /* ---------------- PHOTOS UPDATE ---------------- */
    const photoFields = ["front", "left", "right", "back"];

    if (req.files) {
      for (let field of photoFields) {
        if (req.files[field] && req.files[field][0]) {
          // Delete old image if exists
          if (animal.photos?.[field]?.public_id) {
            await cloudinary.uploader.destroy(animal.photos[field].public_id);
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

    await animal.save();

    req.flash("success", "Animal updated successfully");
    res.redirect(`/admin/animals/${animal._id}`);
  } catch (error) {
    console.error("Update animal error:", error);
    req.flash("error", "Failed to update animal");
    res.redirect("/admin/animals");
  }
};

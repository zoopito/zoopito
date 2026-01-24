const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
const crypto = require("crypto");

module.exports.vaccinationindex = async (req, res) => {
  try {
    res.render("admin/vaccinations/index.ejs");
  } catch (error) {
    console.error("Error rendering vaccination dashboard:", error);
    req.flash("error", "Unable to load vaccination dashboard at this time.");
    res.status(500).send("Internal Server Error");
  }
};

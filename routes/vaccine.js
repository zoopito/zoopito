const express = require("express");
const router = express.Router();
const { isLoggedIn, isSales, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const animalController = require("../controllers/animal.js");
const multer = require("multer");
const ParavetController = require("../controllers/paravet.js");
const vaccineController = require("../controllers/vaccine.js");
const { cloudinary, storage } = require("../Cloudconfig.js");
const animal = require("../models/animal.js");
const upload = multer({ storage });

// router.route("/login").get(userController.renderLoginForm);

// Admin only routes
router.get("/new", isLoggedIn, isAdmin, vaccineController.renderVaccineForm);
router.post("/", isLoggedIn, isAdmin, vaccineController.createVaccine);
router.get(
  "/:id/edit",
  isLoggedIn,
  isAdmin,
  vaccineController.renderVaccineForm,
);
router.put("/:id", isLoggedIn, isAdmin, vaccineController.updateVaccine);
router.patch(
  "/:id/toggle-active",
  isLoggedIn,
  isAdmin,
  vaccineController.toggleActive,
);
router.delete("/:id", isLoggedIn, isAdmin, vaccineController.deleteVaccine);

// Public routes (for viewing)
router.get("/", vaccineController.getAllVaccines);
router.get("/:id", vaccineController.getVaccine);

module.exports = router;

const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const paravetController = require("../controllers/paravet.js");
const animalController = require("../controllers/animal.js");
const vaccinationController = require("../controllers/vaccination.js");
const othersController = require("../controllers/others.js");
const multer = require("multer");

const { cloudinary, storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

router.get("/new", vaccinationController.renderNewForm);
router.get("/batch/:batchId", vaccinationController.viewBatch);
router.get("/:id", vaccinationController.viewVaccination);
router.get("/:id/edit", vaccinationController.renderEditForm);

// POST routes
router.post("/", vaccinationController.addVaccination);
router.post("/calculate-next-due", vaccinationController.calculateNextDueDate);

// PUT/PATCH routes
router.put("/:id", vaccinationController.updateVaccination);
router.patch("/:id/verify", vaccinationController.verifyStatus);

// DELETE routes
router.delete("/:id", vaccinationController.deleteVaccination);

// AJAX routes
router.get(
  "/api/farmers/:farmerId/animals",
  vaccinationController.getAnimalsByFarmer,
);
router.get("/api/vaccines/:vaccineId", vaccinationController.getVaccineDetails);

module.exports = router;

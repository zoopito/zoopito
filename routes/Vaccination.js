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

// ================= STATIC ROUTES =================
router.get("/new", vaccinationController.renderNewForm);

// ================= PAYMENT ROUTES =================
router.get("/payment", vaccinationController.renderPaymentPage);
router.post("/payment/verify", vaccinationController.verifyPayment);

// ================= ADMIN PAYMENT ROUTES =================
router.get("/payments/pending", vaccinationController.viewPendingPayments);

// ================= BATCH ROUTES =================
router.get("/batch/:batchId", vaccinationController.viewBatch);

// ================= API ROUTES =================
router.get(
  "/api/farmers/:farmerId/animals",
  vaccinationController.getAnimalsByFarmer,
);

router.get(
  "/api/vaccines/:vaccineId/price",
  vaccinationController.getVaccinePrice,
);

router.post("/calculate-next-due", vaccinationController.calculateNextDueDate);

// ================= CREATE =================
router.post("/", vaccinationController.addVaccination);

// ================= UPDATE =================
router.put("/:id", vaccinationController.updateVaccination);

// ================= VERIFY =================
router.patch("/:id/verify", vaccinationController.verifyStatus);

// ================= ADMIN VERIFY PAYMENT =================
router.post("/:id/verify-payment", vaccinationController.adminVerifyPayment);

// ================= EDIT =================
router.get("/:id/edit", vaccinationController.renderEditForm);

// ================= DELETE =================
router.delete("/:id", vaccinationController.deleteVaccination);

// ================= VIEW SINGLE (ALWAYS LAST) =================
router.get("/:id", vaccinationController.viewVaccination);

module.exports = router;

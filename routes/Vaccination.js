const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const paravetController = require("../controllers/paravet.js");
const animalController = require("../controllers/animal.js");
const vaccinationController = require("../controllers/vaccination.js");
const taskController = require("../controllers/taskScheduller.js");
const othersController = require("../controllers/others.js");
const multer = require("multer");

const { cloudinary, storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

// ================= STATIC ROUTES =================
router.get("/new", vaccinationController.renderNewForm);

// ================= VACCINATION RECORDING & VERIFICATION =================
// Render vaccination recording form
router.get("/record", isLoggedIn, vaccinationController.renderVaccinationRecordForm);

// Render admin verification page
router.get("/:id/verify-page", isLoggedIn, isAdmin, vaccinationController.renderVaccinationVerifyPage);

router.get("/schedule", taskController.renderSchedulePage);

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

// ================= NEW VACCINATION MANAGEMENT ROUTES =================
// Record vaccination (Paravet submits)
router.post("/:animalId/record", isLoggedIn, vaccinationController.recordVaccination);

// Complete vaccination (Mark as complete & auto-calc next due)
router.post("/:id/complete", isLoggedIn, vaccinationController.completeVaccination);

// Admin verify vaccination
router.post("/:id/verify", isLoggedIn, isAdmin, vaccinationController.adminVerifyVaccination);

// Edit next due date (Admin testing)
router.post("/:id/edit-next-due", isLoggedIn, isAdmin, vaccinationController.editNextDueDate);

// Get animal vaccination schedule
router.get("/animal/:animalId/schedule", vaccinationController.getAnimalVaccinationSchedule);

// ================= CREATE =================
router.post("/", vaccinationController.addVaccination);

// ================= UPDATE =================
router.put("/:id", vaccinationController.updateVaccination);

// ================= DELETE =================
router.delete("/:id", vaccinationController.deleteVaccination);

// ================= VERIFY =================
router.patch("/:id/verify", vaccinationController.verifyStatus);

// ================= ADMIN VERIFY PAYMENT =================
router.post("/:id/verify-payment", vaccinationController.adminVerifyPayment);

// ================= EDIT =================
router.get("/:id/edit", vaccinationController.renderEditForm);


// ================= VIEW SINGLE (ALWAYS LAST) =================
router.get("/:id", vaccinationController.viewVaccination);

//................................//
// task schedulling routes
//..................................//

// API endpoints for schedule page
router.get("/api/pending-vaccinations", taskController.getPendingVaccinations);
router.get("/api/area-stats", taskController.getAreaStats);
router.get(
  "/api/farmer-vaccinations/:farmerId",
  taskController.getFarmerVaccinations,
);
router.get("/api/paravet-assignments", taskController.getParavetAssignments);

// Assignment routes
router.post("/api/assign-paravet", taskController.assignParavetToVaccinations);
router.get("/api/vaccination/:id", taskController.getVaccination);
router.get(
  "/api/animal/:animalId/history",
  taskController.getVaccinationHistory,
);
router.post("/api/bulk-assign", taskController.bulkAssignParavets);
router.post("/api/bulk-complete", vaccinationController.bulkCompleteVaccinations);
router.post("/api/schedule-date", taskController.scheduleDate);

// Update vaccination status
router.patch(
  "/api/vaccination/:id/status",
  taskController.updateVaccinationStatus,
);

router.get("/api/vaccine/:vaccineId/next-due", isLoggedIn, vaccinationController.getVaccineNextDueInfo);

// Delete vaccination
//router.delete("/api/vaccination/:id", vaccinationController.deleteVaccination);

// Delete vaccination
router.delete("/api/vaccination/:id", taskController.deleteVaccination);

// Export schedule
router.get("/export/schedule", taskController.exportSchedule);

module.exports = router;

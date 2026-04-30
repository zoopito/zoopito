const express = require("express");
const router = express.Router();
const { isLoggedIn, isParavet } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const paravetController = require("../controllers/paravet.js");
const animalController = require("../controllers/animal.js");
const vaccinationController = require("../controllers/vaccination.js");
const othersController = require("../controllers/others.js");
const multer = require("multer");

const { cloudinary, storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

router
  .route("/farmers")
  .get(isLoggedIn, isParavet, formerController.farmersIndex);
router
  .route("/farmers/:id")
  .get(isLoggedIn, isParavet, formerController.viewFarmer);

router
  .route("/paravets/:id")
  .get(isLoggedIn, isParavet, paravetController.viewParavet);

router.get(
  "/animals",
  isLoggedIn,
  isParavet,
  animalController.animalsIndexPage,
);
router.get(
  "/animals/new",
  isLoggedIn,
  isParavet,
  animalController.createAnimalForm,
);

/**
 * @route   POST /admin/animals/bulk
 * @desc    Register multiple animals in bulk
 * @access  Admin
 */
router.post(
  "/animals/bulk",
  upload.fields([
    // Support up to 20 animals with 4 photos each
    ...Array.from({ length: 20 }, (_, i) => [
      { name: `animals[${i}][photos][front]`, maxCount: 1 },
      { name: `animals[${i}][photos][left]`, maxCount: 1 },
      { name: `animals[${i}][photos][right]`, maxCount: 1 },
      { name: `animals[${i}][photos][back]`, maxCount: 1 },
    ]).flat(),
  ]),
  isLoggedIn,
  isParavet,
  animalController.bulkCreateAnimals,
);

router.post(
  "/animals",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "left", maxCount: 1 },
    { name: "right", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  isLoggedIn,
  isParavet,
  animalController.createAnimal,
);

router
  .route("/animals/:id")
  .get(isLoggedIn, isParavet, animalController.viewAnimal)
  .put(
    upload.fields([
      { name: "front", maxCount: 1 },
      { name: "left", maxCount: 1 },
      { name: "right", maxCount: 1 },
      { name: "back", maxCount: 1 },
    ]),
    isLoggedIn,
    isParavet,
    animalController.updateAnimal,
  );
router.get(
  "/animals/:id/edit",
  isLoggedIn,
  isParavet,
  animalController.renderEditForm,
);

// Animal routes
router.get(
  "/animal/export",
  isLoggedIn,
  isParavet,
  animalController.exportAnimals,
);

// Individual animal routes
router.delete(
  "/animal/:id",
  isLoggedIn,
  isParavet,
  animalController.deleteAnimal,
);

// Bulk animal routes
router.post(
  "/animals/bulk/delete",
  isLoggedIn,
  isParavet,
  animalController.bulkDeleteAnimals,
);

// Status routes
router.post(
  "/animal/:id/deactivate",
  isLoggedIn,
  isParavet,
  animalController.toggleAnimalStatus,
);
router.post(
  "/animal/:id/activate",
  isLoggedIn,
  isParavet,
  animalController.toggleAnimalStatus,
);
router.post(
  "/animal/:id/quick-update",
  isLoggedIn,
  isParavet,
  animalController.quickStatusUpdate,
);

// Transfer routes
router.get(
  "/animal/:id/transfer",
  isLoggedIn,
  isParavet,
  animalController.getTransferForm,
);
router.post(
  "/animal/:id/transfer",
  isLoggedIn,
  isParavet,
  animalController.transferAnimal,
);

// Health routes
router.get(
  "/animal/:id/health",
  isLoggedIn,
  isParavet,
  animalController.viewHealthRecords,
);
router.get(
  "/animal/:id/health/add",
  isLoggedIn,
  isParavet,
  animalController.getAddHealthRecordForm,
);
router.post(
  "/animal/:id/health",
  isLoggedIn,
  isParavet,
  animalController.addHealthRecord,
);

// Breeding routes
router.get(
  "/animal/:id/breeding/add",
  isLoggedIn,
  isParavet,
  animalController.getAddBreedingRecordForm,
);
router.post(
  "/animal/:id/breeding",
  isLoggedIn,
  isParavet,
  animalController.addBreedingRecord,
);

// Report routes
router.get(
  "/animal/:id/report",
  isLoggedIn,
  isParavet,
  animalController.generateAnimalReport,
);

router.get(
  "/vaccinations",
  isLoggedIn,
  isParavet,
  vaccinationController.vaccinationindex,
);

//-----------------------//
//paravet routes
//-----------------------//

// Dashboard home
router.get("/dashboard", paravetController.getDashboard);

// API endpoints for dashboard data
router.get("/api/stats", paravetController.getStats);
router.get("/api/upcoming-schedules", paravetController.getUpcomingSchedules);
router.get("/api/recent-activities", paravetController.getRecentActivities);
router.get("/api/farmer-list", paravetController.getFarmerList);
router.get("/api/performance-metrics", paravetController.getPerformanceMetrics);

// Task management
router.get("/tasks", paravetController.getTasks);
router.get("/vaccination/:id/complete", paravetController.getVaccinationCompletionForm);
router.post("/tasks/:id/complete", paravetController.completeTask);
router.post("/tasks/:id/reschedule", paravetController.rescheduleTask);

// Farmer visit routes
router.get("/farmer/:farmerId/animals", paravetController.getFarmerAnimals);
router.post("/visit/start", paravetController.startVisit);
router.post("/visit/complete", paravetController.completeVisit);

// Vaccination routes for paravet
router.get("/vaccination/pending", paravetController.getPendingVaccinations);
router.post("/vaccination/:id/perform", paravetController.performVaccination);
router.post(
  "/vaccination/bulk-perform",
  paravetController.bulkPerformVaccinations,
);

// Reports
router.get("/reports/daily", paravetController.getDailyReport);
router.get("/reports/weekly", paravetController.getWeeklyReport);
router.get("/reports/monthly", paravetController.getMonthlyReport);




router.get("/api/dashboard-stats", paravetController.getDashboardStats);

// ================ FARMER MANAGEMENT ================
router.get("/farmers", paravetController.getFarmers);
router.get("/farmers/:farmerId", paravetController.getFarmerDetails);
router.get("/api/farmers/:farmerId/location", paravetController.getFarmerLocation);

// ================ BULK VACCINATION ================
router.get("/farmers/:farmerId/vaccinate", paravetController.getBulkVaccinationForm);
router.post("/farmers/:farmerId/vaccinate", paravetController.submitBulkVaccination);

// ================ ANIMAL MANAGEMENT ================
router.get("/animals/needing-care", paravetController.getAnimalsNeedingVaccination);
router.post("/animals/:animalId/tag", paravetController.markAnimalTagged);

// ================ VACCINATION HISTORY ================
router.get("/vaccinations/history/:animalId", paravetController.getVaccinationHistory);
router.put("/vaccinations/:id", paravetController.updateVaccinationRecord);

// ================ SCHEDULES ================
router.get("/schedules", paravetController.getUpcomingSchedules);

// ================ REPORTS ================
router.get("/reports", paravetController.getReports);

// Redirect root to dashboard
router.get("/", (req, res) => {
  res.redirect("/paravet/dashboard");
});

module.exports = router;

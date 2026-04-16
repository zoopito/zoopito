const express = require("express");
const router = express.Router();
const { isLoggedIn, isFarmer } = require("../middleware");
const farmerController = require("../controllers/farmer");

// All farmer routes require login and farmer role
router.use(isLoggedIn, isFarmer);

// Dashboard
router.get("/dashboard", farmerController.getDashboard);

// Animal Management
router.get("/animals", farmerController.getMyAnimals);
router.get("/animal/:id", farmerController.getAnimalDetails);

// Vaccination History
router.get("/vaccinations", farmerController.getVaccinationHistory);

// Payment History
router.get("/payments", farmerController.getPaymentHistory);

// Redirect root to dashboard
router.get("/", (req, res) => {
    res.redirect("/farmer/dashboard");
});

module.exports = router;
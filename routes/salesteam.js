const express = require("express");
const router = express.Router();
const { isLoggedIn, isSales } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const multer = require("multer");

const { cloudinary, storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

// router.route("/login").get(userController.renderLoginForm);

router.get(
  "/sales-team/:id",
  isLoggedIn,
  isSales,
  adminController.viewSalesMember,
);
router.get("/farmers", isLoggedIn, isSales, formerController.farmersIndex);
router.get(
  "/farmers/new",
  isLoggedIn,
  isSales,
  formerController.createFarmerForm,
);
router.post(
  "/farmers",
  upload.single("image"),
  isLoggedIn,
  isSales,
  formerController.createFarmer,
);
router.get("/farmers/:id", isLoggedIn, isSales, formerController.viewFarmer);

module.exports = router;

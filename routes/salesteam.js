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

// farmer routes
router
  .route("/farmers")
  .get(isLoggedIn, isSales, formerController.farmersIndex)
  .post(
    upload.single("image"),
    isLoggedIn,
    isSales,
    formerController.createFarmer,
  );
router.get(
  "/farmers/new",
  isLoggedIn,
  isSales,
  formerController.createFarmerForm,
);
router
  .route("/farmers/:id")
  .get(isLoggedIn, isSales, formerController.viewFarmer)
  .put(
    upload.single("image"),
    isLoggedIn,
    isSales,
    formerController.updateFarmer,
  )
  .delete(isLoggedIn, isSales, formerController.deleteFarmer);
router.get(
  "/farmers/:id/edit",
  isLoggedIn,
  isSales,
  formerController.renderEditform,
);
router.patch(
  "/farmers/:id/toggle-status",
  isLoggedIn,
  isSales,
  formerController.toggleFarmerStatus,
);

module.exports = router;

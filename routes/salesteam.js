const express = require("express");
const router = express.Router();
const { isLoggedIn, isSales } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const animalController = require("../controllers/animal.js");
const multer = require("multer");
const ParavetController = require("../controllers/paravet.js");

const { cloudinary, storage } = require("../Cloudconfig.js");
const animal = require("../models/animal.js");
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

// animal route
router.get("/animals", isLoggedIn, isSales, animalController.animalsIndexPage);
router.get(
  "/animals/new",
  isLoggedIn,
  isSales,
  animalController.createAnimalForm,
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
  isSales,
  animalController.createAnimal,
);

router
  .route("/animals/:id")
  .get(isLoggedIn, isSales, animalController.viewAnimal)
  .put(
    upload.fields([
      { name: "front", maxCount: 1 },
      { name: "left", maxCount: 1 },
      { name: "right", maxCount: 1 },
      { name: "back", maxCount: 1 },
    ]),
    isLoggedIn,
    isSales,
    animalController.updateAnimal,
  );
router.get(
  "/animals/:id/edit",
  isLoggedIn,
  isSales,
  animalController.renderEditForm,
);
router.get("/paravets", isLoggedIn, isSales, adminController.paravetsIndexpage);
router.get("/paravets/:id", isLoggedIn, isSales, ParavetController.viewParavet);

module.exports = router;

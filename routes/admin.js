const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const paravetController = require("../controllers/paravet.js");
const animalController = require("../controllers/animal.js");
const multer = require("multer");

const { cloudinary, storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

// router.route("/login").get(userController.renderLoginForm);
router.get("/sales-team", isLoggedIn, isAdmin, adminController.salesindex);
router.get(
  "/sales-team/new",
  isLoggedIn,
  isAdmin,
  adminController.addnewSalesMemberForm,
);
router.post(
  "/sales-team/new",
  isLoggedIn,
  isAdmin,
  adminController.createSalesMember,
);
router.get(
  "/sales-team/:id",
  isLoggedIn,
  isAdmin,
  adminController.viewSalesMember,
);
router.get("/farmers", isLoggedIn, isAdmin, formerController.farmersIndex);
router.get(
  "/farmers/new",
  isLoggedIn,
  isAdmin,
  formerController.createFarmerForm,
);
router.post(
  "/farmers",
  upload.single("image"),
  isLoggedIn,
  isAdmin,
  formerController.createFarmer,
);
router.get("/farmers/:id", isLoggedIn, isAdmin, formerController.viewFarmer);

// paravets
router.get("/paravets", isLoggedIn, isAdmin, adminController.paravetsIndexpage);
router.get(
  "/paravets/new",
  isLoggedIn,
  isAdmin,
  paravetController.createParavetForm,
);
router.post("/paravets", isLoggedIn, isAdmin, paravetController.createParavet);
router.get("/paravets/:id", isLoggedIn, isAdmin, paravetController.viewParavet);
router.get("/animals", isLoggedIn, isAdmin, animalController.animalsIndexPage);
router.get(
  "/animals/new",
  isLoggedIn,
  isAdmin,
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
  isAdmin,
  animalController.createAnimal,
);

router.get("/animals/:id", isLoggedIn, isAdmin, animalController.viewAnimal);
module.exports = router;

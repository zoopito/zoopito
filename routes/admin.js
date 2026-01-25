const express = require("express");
const router = express.Router();
const { isLoggedIn, isAdmin } = require("../middleware");
const adminController = require("../controllers/admin.js");
const formerController = require("../controllers/farmer.js");
const paravetController = require("../controllers/paravet.js");
const animalController = require("../controllers/animal.js");
const vaccinationController = require("../controllers/vaccination.js");
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
router
  .route("/sales-team/:id")
  .get(isLoggedIn, isAdmin, adminController.viewSalesMember)
  .put(isLoggedIn, isAdmin, adminController.updateSalesMember);
router.get(
  "/sales-team/:id/edit",
  isLoggedIn,
  isAdmin,
  adminController.editSalesMemberForm,
);
router.post(
  "/sales-team/:id/activate",
  isLoggedIn,
  isAdmin,
  adminController.activateSalesMember,
);

router.post(
  "/sales-team/:id/deactivate",
  adminController.deactivateSalesMember,
);
router.post(
  "/sales-team/:id/delete",
  isLoggedIn,
  isAdmin,
  adminController.deleteSalesMember,
);

router
  .route("/farmers")
  .get(isLoggedIn, isAdmin, formerController.farmersIndex)
  .post(
    upload.single("image"),
    isLoggedIn,
    isAdmin,
    formerController.createFarmer,
  );
router.get(
  "/farmers/new",
  isLoggedIn,
  isAdmin,
  formerController.createFarmerForm,
);
router
  .route("/farmers/:id")
  .get(isLoggedIn, isAdmin, formerController.viewFarmer)
  .put(
    upload.single("image"),
    isLoggedIn,
    isAdmin,
    formerController.updateFarmer,
  )
  .delete(isLoggedIn, isAdmin, formerController.deleteFarmer);
router.get(
  "/farmers/:id/edit",
  isLoggedIn,
  isAdmin,
  formerController.renderEditform,
);
router.patch(
  "/farmers/:id/toggle-status",
  isLoggedIn,
  isAdmin,
  formerController.toggleFarmerStatus,
);

// paravets
router.get("/paravets", isLoggedIn, isAdmin, adminController.paravetsIndexpage);
router.get(
  "/paravets/new",
  isLoggedIn,
  isAdmin,
  paravetController.createParavetForm,
);
router.post("/paravets", isLoggedIn, isAdmin, paravetController.createParavet);
router
  .route("/paravets/:id")
  .get(isLoggedIn, isAdmin, paravetController.viewParavet)
  .post(isLoggedIn, isAdmin, paravetController.updateParavet)
  .put(isLoggedIn, isAdmin, paravetController.updateParavet)
  .delete(isLoggedIn, isAdmin, paravetController.deleteParavet)
  .patch(isLoggedIn, isAdmin, paravetController.toggleParavetStatus);

router.get(
  "/paravets/:id/edit",
  isLoggedIn,
  isAdmin,
  paravetController.renderEditForm,
);

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

router
  .route("/animals/:id")
  .get(isLoggedIn, isAdmin, animalController.viewAnimal)
  .put(
    upload.fields([
      { name: "front", maxCount: 1 },
      { name: "left", maxCount: 1 },
      { name: "right", maxCount: 1 },
      { name: "back", maxCount: 1 },
    ]),
    isLoggedIn,
    isAdmin,
    animalController.updateAnimal,
  );
router.get(
  "/animals/:id/edit",
  isLoggedIn,
  isAdmin,
  animalController.renderEditForm,
);

router.get(
  "/vaccinations",
  isLoggedIn,
  isAdmin,
  vaccinationController.vaccinationindex,
);

router.get("/settings", isLoggedIn, isAdmin, adminController.adminSettingPage);
router.get(
  "/settings/newadmin",
  isLoggedIn,
  isAdmin,
  adminController.renderAddAdmin,
);
router.post("/settings", isLoggedIn, isAdmin, adminController.createAdmin);
module.exports = router;

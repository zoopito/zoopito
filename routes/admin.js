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

router.get("/", isLoggedIn, isAdmin, adminController.index);
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
  isAdmin,
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

// Animal routes
router.get(
  "/animal/export",
  isLoggedIn,
  isAdmin,
  animalController.exportAnimals,
);

// Individual animal routes
router.delete(
  "/animal/:id",
  isLoggedIn,
  isAdmin,
  animalController.deleteAnimal,
);

// Bulk animal routes
router.post(
  "/animals/bulk/delete",
  isLoggedIn,
  isAdmin,
  animalController.bulkDeleteAnimals,
);

// Status routes
router.post(
  "/animal/:id/deactivate",
  isLoggedIn,
  isAdmin,
  animalController.toggleAnimalStatus,
);
router.post(
  "/animal/:id/activate",
  isLoggedIn,
  isAdmin,
  animalController.toggleAnimalStatus,
);
router.post(
  "/animal/:id/quick-update",
  isLoggedIn,
  isAdmin,
  animalController.quickStatusUpdate,
);

// Transfer routes
router.get(
  "/animal/:id/transfer",
  isLoggedIn,
  isAdmin,
  animalController.getTransferForm,
);
router.post(
  "/animal/:id/transfer",
  isLoggedIn,
  isAdmin,
  animalController.transferAnimal,
);

// Health routes
router.get(
  "/animal/:id/health",
  isLoggedIn,
  isAdmin,
  animalController.viewHealthRecords,
);
router.get(
  "/animal/:id/health/add",
  isLoggedIn,
  isAdmin,
  animalController.getAddHealthRecordForm,
);
router.post(
  "/animal/:id/health",
  isLoggedIn,
  isAdmin,
  animalController.addHealthRecord,
);

// Breeding routes
router.get(
  "/animal/:id/breeding/add",
  isLoggedIn,
  isAdmin,
  animalController.getAddBreedingRecordForm,
);
router.post(
  "/animal/:id/breeding",
  isLoggedIn,
  isAdmin,
  animalController.addBreedingRecord,
);

// Report routes
router.get(
  "/animal/:id/report",
  isLoggedIn,
  isAdmin,
  animalController.generateAnimalReport,
);

router.get(
  "/vaccinations",
  isLoggedIn,
  isAdmin,
  vaccinationController.vaccinationindex,
);

//
// Admin Settings and User Management

router.get("/settings", isLoggedIn, isAdmin, adminController.adminSettingPage);
router.get(
  "/settings/newadmin",
  isLoggedIn,
  isAdmin,
  adminController.renderAddAdmin,
);
router.post("/settings", isLoggedIn, isAdmin, adminController.createAdmin);
router.get("/contacts", isLoggedIn, isAdmin, othersController.showContacts);
router.get("/allusers", isLoggedIn, isAdmin, adminController.allUsers);

router.get("/users/export", isLoggedIn, isAdmin, adminController.exportUsers);
// router.get("/users/create", isLoggedIn, isAdmin, adminController.getCreateForm);
// router.post("/users", isLoggedIn, isAdmin, adminController.createUser);
router.get("/users/:id", isLoggedIn, isAdmin, adminController.viewUser);
// router.get("/users/:id/edit", isLoggedIn, isAdmin, adminController.getEditForm);
// router.put("/users/:id", isLoggedIn, isAdmin, adminController.updateUser);
//router.delete("/users/:id", isLoggedIn, isAdmin, adminController.deleteUser);

// User Status Management
router.post(
  "/users/:id/activate",
  isLoggedIn,
  isAdmin,
  adminController.activateUser,
);
router.post(
  "/users/:id/deactivate",
  isLoggedIn,
  isAdmin,
  adminController.deactivateUser,
);
router.post("/users/:id/block", isLoggedIn, isAdmin, adminController.blockUser);
router.post(
  "/users/:id/unblock",
  isLoggedIn,
  isAdmin,
  adminController.unblockUser,
);
// router.post("/allusers/:id/reset-password", adminController.resetPassword);
// router.get("/allusers/:id/login-history", adminController.loginHistory);

module.exports = router;

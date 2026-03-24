const express = require("express");
const router = express.Router();
const authController = require("../controllers/authcontroller.js");
const { saveRedirectUrl, setMetatag } = require("../middleware.js");
const adminController = require("../controllers/admin.js")

router.get("/forgot-password", authController.restform);
router.post("/forgot-password", saveRedirectUrl, authController.forgotPassword);
router.get('/reset-password', adminController.renderResetPasswordForm);
router.post('/reset-password', adminController.resetPassword);
router.get("/reset-password/:token", authController.getResetPassword);
router.post("/reset-password/:token", authController.postResetPassword);

//router.get("/ibsa/task", homeController.addtask);

module.exports = router;

const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isVerified } = require("../middleware.js");

const userController = require("../controllers/users.js");

// signup GET
// Signup POST
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

//Login GET
//Login POST
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    isVerified,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login,
  );

router.get("/logout", userController.logout);
router.post("/verify/:id/resend", userController.resendOtp);
router.get("/verify-email", userController.renderVerifyEmailForm);
router.post("/verify/:id", userController.verifyEmail);
router.get("/profile", userController.profile);

module.exports = router;

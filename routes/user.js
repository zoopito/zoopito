const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { isLoggedIn, saveRedirectUrl, isVerified } = require("../middleware.js");
const userController = require("../controllers/users.js");

// ================================================================
// AUTHENTICATION ROUTES
// ================================================================

// Signup
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

// Login
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

// Logout
router.get("/logout", userController.logout);

// ================================================================
// OTP VERIFICATION
// ================================================================

router.post("/verify/:id/resend", userController.resendOtp);
router.get("/verify-email", userController.renderVerifyEmailForm);
router.post("/verify/:id", userController.verifyEmail);

// ================================================================
// PROFILE & ACCOUNT
// ================================================================

// Profile
router.get('/profile', isLoggedIn, userController.profile);
router.post('/profile/update', isLoggedIn, userController.updateProfile);

// Change Password
router.get('/change-password', isLoggedIn, userController.renderChangePassword);
router.post('/change-password', isLoggedIn, userController.changePassword);

// Account Settings
router.get('/profile/settings', isLoggedIn, userController.renderSettings);
router.post('/settings/notifications', isLoggedIn, userController.updateNotifications);
router.post('/settings/display', isLoggedIn, userController.updateDisplaySettings);

// Account Management (Danger Zone)
router.post('/account/deactivate', isLoggedIn, userController.deactivateAccount);
router.post('/account/delete', isLoggedIn, userController.deleteAccount);

// ================================================================
// FORGOT / RESET PASSWORD
// ================================================================

router.get('/forgot-password', userController.renderForgotPassword);
router.post('/forgot-password', userController.forgotPassword);
router.get('/reset-password', userController.renderResetPassword);
router.post('/reset-password', userController.postResetPassword);

module.exports = router;
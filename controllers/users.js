const User = require("../models/user.js");
const crypto = require("crypto");

module.exports.renderSignupForm = (req, res) => {
  const csrfToken = null; //req.csrfToken();
  res.render("users/signup.ejs", { csrfToken });
};

module.exports.signup = async (req, res, next) => {
  try {
    let { name, email, password } = req.body;
    const newUser = new User({ email, name });
    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, async (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Thanks for joining Zoopito!");
      res.redirect("/");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  if (req.user) {
    return res.redirect("/");
  } else {
    res.render("users/login.ejs");
  }
};

module.exports.login = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", "Authentication failed. Please login again.");
      return res.redirect("/login");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/login");
    }

    user.lastLogin = new Date();

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

    user.loginHistory.unshift({
      ip,
      userAgent: req.headers["user-agent"],
      loginAt: new Date(),
    });

    // keep only last 10 logins
    if (user.loginHistory.length > 10) {
      user.loginHistory = user.loginHistory.slice(0, 10);
    }

    await user.save();

    req.flash("success", "Happy to see you again!");
    const redirectUrl = res.locals.redirectUrl || "/";
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error", "Something went wrong during login.");
    res.redirect("/login");
  }
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/login");
  });
};

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
  req.flash("success", "Happy to see you again!");
  let redirectUrl = res.locals.redirectUrl || "/";
  res.redirect(redirectUrl);
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

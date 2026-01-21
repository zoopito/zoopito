const crypto = require("crypto");
const User = require("../models/user.js");

// Load .env in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

/* ─────────────────────────────────────────
   RENDER FORGOT PASSWORD FORM
───────────────────────────────────────── */
module.exports.restform = async (req, res) => {
  res.render("emailer/emailSent.ejs", {
    message: "Enter your registered email address",
    alertmsg: false,
  });
};

/* ─────────────────────────────────────────
   FORGOT PASSWORD → GENERATE RESET LINK
───────────────────────────────────────── */
module.exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.render("emailer/emailSent.ejs", {
        message: "Email is required",
        alertmsg: true,
      });
    }

    const user = await User.findOne({ email });

    // Security: don't reveal whether user exists
    if (!user) {
      return res.render("emailer/emailSent.ejs", {
        message:
          "If this email is registered, a password reset link has been sent.",
        alertmsg: false,
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Auto-detect domain (Zoopito)
    const domain =
      process.env.DOMAIN ||
      (process.env.NODE_ENV === "production"
        ? "https://zoopito.com"
        : "http://localhost:3000");

    const resetLink = `${domain}/reset-password/${token}`;

    /* ─────────────────────────────────────────
       BREVO EMAIL CONFIG (UNCHANGED)
    ───────────────────────────────────────── */
    const brevo = require("@getbrevo/brevo");
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY,
    );

    // EMAIL TEMPLATE – ZOOPITO
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:24px; background:#f9fafb; border-radius:10px;">
        
        <div style="text-align:center; margin-bottom:20px;">
          <h1 style="color:#16a34a;">Zoopito</h1>
          <p style="color:#555;">Secure Account Recovery</p>
        </div>

        <h2 style="color:#111;">Reset Your Password</h2>

        <p>Hello <strong>${user.name || "Zoopito User"}</strong>,</p>

        <p>
          We received a request to reset your password for your Zoopito account.
          This account may belong to a <b>Farmer</b>, <b>Sales Member</b>, or <b>Admin</b>.
        </p>

        <div style="text-align:center; margin:30px 0;">
          <a href="${resetLink}" 
             style="background:#16a34a; color:#ffffff; padding:12px 28px; 
                    text-decoration:none; border-radius:8px; font-size:16px;">
            Reset Password
          </a>
        </div>

        <p>
          This link will expire in <strong>1 hour</strong>.
        </p>

        <p style="word-break:break-all;">
          If the button does not work, copy and paste this link:
          <br>
          <a href="${resetLink}" style="color:#2563eb;">
            ${resetLink}
          </a>
        </p>

        <hr style="border:none; border-top:1px solid #ddd; margin:30px 0;">

        <p style="font-size:12px; color:#777;">
          If you did not request this password reset, you can safely ignore this email.
          <br>
          This is an automated message from Zoopito.
        </p>
      </div>
    `;

    // SEND EMAIL
    await apiInstance.sendTransacEmail({
      sender: {
        email: "thecubicals123@gmail.com",
        name: "Zoopito",
      },
      to: [{ email: user.email }],
      subject: "Reset Your Zoopito Password",
      htmlContent,
    });

    req.flash(
      "success",
      "If the email exists, a password reset link has been sent.",
    );
    return res.redirect("/login");
  } catch (error) {
    console.error("Zoopito Reset Email Error:", error);
    req.flash("error", "Unable to send reset email. Try again later.");
    return res.redirect("/login");
  }
};

/* ─────────────────────────────────────────
   SHOW RESET PASSWORD PAGE
───────────────────────────────────────── */
module.exports.getResetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Reset link is invalid or expired");
      return res.redirect("/login");
    }

    res.render("emailer/reset.ejs", { token: req.params.token });
  } catch (error) {
    console.error("Get Reset Error:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/login");
  }
};

/* ─────────────────────────────────────────
   RESET PASSWORD (FINAL)
───────────────────────────────────────── */
module.exports.postResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      req.flash("error", "Password must be at least 8 characters");
      return res.redirect("back");
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Reset link is invalid or expired");
      return res.redirect("/login");
    }

    user.setPassword(password, async (err, updatedUser) => {
      if (err) {
        req.flash("error", "Failed to reset password");
        return res.redirect("/login");
      }

      updatedUser.resetPasswordToken = undefined;
      updatedUser.resetPasswordExpires = undefined;
      await updatedUser.save();

      req.flash("success", "Password reset successfully. Please login.");
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Post Reset Error:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/login");
  }
};

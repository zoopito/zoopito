const User = require("../models/user.js");
const Paravet = require("../models/paravet.js");
const Farmer = require("../models/farmer.js");
const SalesTeam = require("../models/salesteam.js");
const Animal = require("../models/animal.js");
const Vaccination = require("../models/vaccination.js");
const crypto = require("crypto");
const brevo = require("@getbrevo/brevo");
const moment = require("moment");

// Load environment variables (only in development)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Configure Brevo API
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

const emailApi = new brevo.TransactionalEmailsApi();
emailApi.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

// Constants
const OTP_EXPIRY_MINUTES = 10;
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;

// ================================================================
// EMAIL TEMPLATES
// ================================================================

async function sendVerificationOTP(user) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  user.otp = otp;
  user.otpExpires = Date.now() + OTP_EXPIRY_MS;
  await user.save();

  const domain = process.env.DOMAIN || "https://zoopito.in";

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email | Zoopito</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      body {
        font-family: 'Inter', Arial, sans-serif;
        line-height: 1.6;
        color: #374151;
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
      }
      
      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
      }
      
      .header {
        background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%);
        padding: 40px 20px;
        text-align: center;
        color: white;
      }
      
      .logo {
        font-size: 36px;
        font-weight: 800;
        margin-bottom: 10px;
        letter-spacing: -0.5px;
      }
      
      .logo-gradient {
        background: linear-gradient(90deg, #60a5fa 0%, #22d3ee 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .subtitle {
        font-size: 14px;
        opacity: 0.9;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-weight: 500;
      }
      
      .content {
        padding: 40px;
      }
      
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 20px;
      }
      
      .message {
        color: #4b5563;
        margin-bottom: 30px;
        font-size: 15px;
        line-height: 1.7;
      }
      
      .otp-container {
        text-align: center;
        margin: 40px 0;
      }
      
      .otp-code {
        display: inline-block;
        padding: 20px 30px;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 8px;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 2px solid #0ea5e9;
        border-radius: 16px;
        color: #0369a1;
        box-shadow: 0 4px 20px rgba(14, 165, 233, 0.15);
      }
      
      .expiry-notice {
        background-color: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 16px;
        border-radius: 8px;
        margin: 30px 0;
        color: #92400e;
        font-size: 14px;
      }
      
      .security-error {
        background-color: #fef2f2;
        border-left: 4px solid #ef4444;
        padding: 16px;
        border-radius: 8px;
        margin: 30px 0;
        color: #991b1b;
        font-size: 14px;
      }
      
      .support-info {
        background-color: #f0f9ff;
        border-radius: 12px;
        padding: 25px;
        margin: 40px 0;
        border: 1px solid #bae6fd;
      }
      
      .footer {
        background-color: #f9fafb;
        padding: 30px 40px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
      }
      
      .contact-link {
        color: #2563eb;
        text-decoration: none;
        font-weight: 500;
      }
      
      @media (max-width: 600px) {
        .content, .footer {
          padding: 30px 20px;
        }
        
        .header {
          padding: 30px 20px;
        }
        
        .otp-code {
          font-size: 28px;
          letter-spacing: 6px;
          padding: 15px 20px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">
          <span class="logo-gradient">Zoopito</span>
        </div>
        <div class="subtitle">Email Verification Required</div>
      </div>
      
      <div class="content">
        <div class="greeting">
          Hello ${user.name || user.username || "User"},
        </div>
        
        <div class="message">
          <p>Thank you for choosing <strong>Zoopito</strong> – India's leading livestock intelligence platform.</p>
          <p>To complete your registration and activate your account, please use the One-Time Password (OTP) below:</p>
        </div>
        
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
        </div>
        
        <div class="expiry-notice">
          ⏰ <strong>Expires in ${OTP_EXPIRY_MINUTES} minutes</strong><br>
          This OTP is valid for ${OTP_EXPIRY_MINUTES} minutes only.
        </div>
        
        <div class="security-error">
          🔒 <strong>Security Notice</strong><br>
          Never share this OTP with anyone. Zoopito staff will never ask for your OTP or password.
        </div>
        
        <div class="support-info">
          <p><strong>Need assistance?</strong></p>
          <p>📧 <a href="mailto:support@zoopito.in" class="contact-link">support@zoopito.in</a></p>
        </div>
      </div>
      
      <div class="footer">
        <p>
          <strong>Zoopito</strong><br>
          Livestock Intelligence Platform
        </p>
        <div style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
          <p>This is an automated security email. Please do not reply directly.</p>
          <p>© ${new Date().getFullYear()} Zoopito. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await emailApi.sendTransacEmail({
      sender: { email: "support@zoopito.in", name: "Zoopito Verification" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: "🔐 Verify Your Email | Zoopito Account Activation",
      htmlContent: htmlContent,
    });
    console.log(`✅ Verification OTP sent to: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send verification email:`, emailErr);
    throw new Error("Failed to send verification email. Please try again.");
  }
  return otp;
}

async function sendWelcomeEmail(user) {
  const domain = process.env.DOMAIN || "https://zoopito.in";

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Zoopito</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      body {
        font-family: 'Inter', Arial, sans-serif;
        line-height: 1.6;
        color: #374151;
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
      }
      
      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
      }
      
      .header {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        padding: 50px 20px;
        text-align: center;
        color: white;
      }
      
      .logo {
        font-size: 42px;
        font-weight: 800;
        margin-bottom: 10px;
        letter-spacing: -1px;
      }
      
      .logo-gradient {
        background: linear-gradient(90deg, #34d399 0%, #10b981 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .success-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }
      
      .content {
        padding: 40px;
      }
      
      .greeting {
        font-size: 24px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 25px;
      }
      
      .message {
        color: #4b5563;
        margin-bottom: 35px;
        font-size: 16px;
        line-height: 1.8;
      }
      
      .cta-button {
        display: inline-block;
        background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
        color: white;
        padding: 18px 45px;
        text-decoration: none;
        border-radius: 14px;
        font-weight: 600;
        font-size: 17px;
        text-align: center;
        margin: 30px 0;
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.25);
      }
      
      .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin: 40px 0;
      }
      
      .feature-card {
        background: #f8fafc;
        border-radius: 12px;
        padding: 25px;
        border: 1px solid #e2e8f0;
      }
      
      .feature-icon {
        font-size: 32px;
        margin-bottom: 15px;
        color: #3b82f6;
      }
      
      .feature-title {
        font-weight: 600;
        color: #1e40af;
        margin-bottom: 10px;
      }
      
      .security-card {
        background-color: #f0f9ff;
        border-radius: 12px;
        padding: 24px;
        margin: 30px 0;
        border: 1px solid #bae6fd;
      }
      
      .footer {
        background-color: #f9fafb;
        padding: 30px 40px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
      }
      
      .contact-link {
        color: #2563eb;
        text-decoration: none;
        font-weight: 500;
      }
      
      @media (max-width: 600px) {
        .content, .footer {
          padding: 30px 20px;
        }
        
        .header {
          padding: 40px 20px;
        }
        
        .features-grid {
          grid-template-columns: 1fr;
        }
        
        .cta-button {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="success-icon">🎉</div>
        <div class="logo">
          <span class="logo-gradient">Zoopito</span>
        </div>
        <div style="font-size: 16px; opacity: 0.9; letter-spacing: 1.5px;">Account Successfully Verified</div>
      </div>
      
      <div class="content">
        <div class="greeting">
          Welcome to Zoopito, ${user.name || user.username || "User"}!
        </div>
        
        <div class="message">
          <p>Congratulations! Your Zoopito account has been successfully verified and activated.</p>
          <p>You are now part of India's premier livestock intelligence platform. Get ready to manage your livestock efficiently.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${domain}/" class="cta-button">
            🚀 Go to Dashboard
          </a>
        </div>
        
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🐄</div>
            <div class="feature-title">Animal Management</div>
            <div>Track and manage all your animals with detailed health records.</div>
          </div>
          
          <div class="feature-card">
            <div class="feature-icon">💉</div>
            <div class="feature-title">Vaccination Tracking</div>
            <div>Keep track of all vaccinations with automated reminders.</div>
          </div>
        </div>
        
        <div class="security-card">
          <strong>🔒 Account Security Tips:</strong>
          <ul style="margin-top: 10px; padding-left: 20px;">
            <li>Use a strong, unique password</li>
            <li>Never share your login credentials</li>
            <li>Regularly review account activity</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
          <p style="color: #4b5563; font-size: 15px;">
            Need assistance? Our support team is here to help.
          </p>
          <p style="margin-top: 10px;">
            📧 <a href="mailto:support@zoopito.in" class="contact-link">support@zoopito.in</a>
          </p>
        </div>
      </div>
      
      <div class="footer">
        <p>
          <strong>Zoopito</strong><br>
          Livestock Intelligence Platform
        </p>
        <div style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
          <p>This is an automated welcome email. Please do not reply directly.</p>
          <p>© ${new Date().getFullYear()} Zoopito. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await apiInstance.sendTransacEmail({
      sender: { email: "support@zoopito.in", name: "Zoopito Welcome Team" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: "🎉 Welcome to Zoopito! Your Account is Now Active",
      htmlContent: htmlContent,
    });
    console.log(`✅ Welcome email sent to: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send welcome email:`, emailErr);
  }
}

async function sendPasswordChangeConfirmation(user) {
  const domain = process.env.DOMAIN || "https://zoopito.in";

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Password Changed | Zoopito</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f6f9; padding: 40px 0; color: #1a1a2e; }
      .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%); padding: 32px 40px; text-align: center; }
      .header h1 { color: white; font-size: 24px; }
      .body { padding: 40px; }
      .success-icon { text-align: center; font-size: 56px; margin-bottom: 16px; }
      .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
      .message { font-size: 15px; line-height: 1.7; color: #4a5568; }
      .security-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin: 16px 0; }
      .security-box .text { font-size: 13px; color: #1e40af; }
      .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
      @media (max-width: 600px) { .body { padding: 24px 20px; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🐄 Zoopito</h1>
        <p>Password Changed ✅</p>
      </div>
      <div class="body">
        <div class="success-icon">✅</div>
        <div class="greeting">Hello ${user.name || user.username || "User"},</div>
        <div class="message">
          Your <strong>Zoopito</strong> account password was successfully changed on <strong>${new Date().toLocaleString()}</strong>.
        </div>
        <div class="security-box">
          <div class="text">
            🛡️ <strong>Security reminder:</strong> If you didn't make this change, please contact support immediately.
          </div>
        </div>
        <div style="text-align:center; margin-top:20px;">
          <a href="${domain}/login" style="color:#0ea5e9; text-decoration:underline;">🔑 Log in to Your Account</a>
        </div>
      </div>
      <div class="footer">
        <div class="brand">Zoopito</div>
        <div style="font-size:12px; color:#94a3b8;">Livestock Intelligence Platform</div>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await apiInstance.sendTransacEmail({
      sender: { email: "support@zoopito.in", name: "Zoopito" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: "✅ Password Changed Successfully | Zoopito",
      htmlContent: htmlContent,
    });
    console.log(`✅ Password change confirmation sent to: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send password change confirmation:`, emailErr);
  }
}

// ================================================================
// AUTHENTICATION ROUTE HANDLERS
// ================================================================

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const username = email.split("@")[0];

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "This email is already registered. Please login.");
      return res.redirect("/login");
    }

    const newUser = new User({ name, email, username, role: "USER" });
    const registeredUser = await User.register(newUser, password);

    req.flash("success", "OTP sent to your email. Please verify your email.");
    res.redirect(`/verify-email?email=${email}`);
  } catch (err) {
    console.error("Signup error:", err.message);
    req.flash("error", err.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  try {
    if (res.locals.currUser) {
      req.flash("info", "You are already logged in.");
      return res.redirect("/");
    }
    res.render("users/login.ejs");
  } catch (err) {
    console.error("❌ Error loading login form:", err);
    req.flash("error", "Unable to load login page. Please try again.");
    res.redirect("/");
  }
};

module.exports.login = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("warning", "Authentication failed. Please login again.");
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

    user.loginHistory = user.loginHistory || [];
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

// ================================================================
// OTP VERIFICATION
// ================================================================

module.exports.renderVerifyEmailForm = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.redirect("/login");
  const user = await User.findOne({ email: email });
  if (!user) {
    req.flash("error", "User not found. Please sign up first.");
    return res.redirect("/signup");
  }
  await sendVerificationOTP(user);
  res.render("emailer/otp.ejs", { user });
};

module.exports.verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const { id } = req.params;

    if (!otp || otp.length !== 6) {
      req.flash("warning", "Please enter a valid 6-digit OTP.");
      return res.redirect(`/verify-email?email=${req.body.email || ""}`);
    }

    const user = await User.findById(id);

    if (!user) {
      req.flash("error", "Invalid verification request. Please try signing up again.");
      return res.redirect("/signup");
    }

    if (user.isVerified) {
      req.flash("info", "Your email is already verified. Please log in.");
      return res.redirect("/login");
    }

    if (!user.otp || !user.otpExpires) {
      req.flash("warning", "No active OTP found. Please request a new verification code.");
      return res.redirect(`/verify-email?email=${user.email}`);
    }

    if (user.otp !== otp) {
      req.flash("error", "Invalid OTP. Please check the code and try again.");
      return res.redirect(`/verify-email?email=${user.email}`);
    }

    if (user.otpExpires < Date.now()) {
      req.flash("warning", "OTP has expired. Please request a new verification code.");
      return res.redirect(`/verify-email?email=${user.email}`);
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    await sendWelcomeEmail(user);

    req.login(user, (err) => {
      if (err) {
        console.error("❌ Auto-login error after verification:", err);
        req.flash("success", "Email verified successfully! Please log in to continue.");
        return res.redirect("/login");
      }
      req.flash("success", "Email verified successfully! Welcome to Zoopito.");
      res.redirect("/");
    });
  } catch (err) {
    console.error("❌ Email verification error:", err);
    req.flash("error", "We encountered an issue verifying your email. Please try again.");
    res.redirect(`/verify-email?email=${req.body.email || ""}`);
  }
};

module.exports.resendOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      req.flash("error", "User account not found.");
      return res.redirect("/signup");
    }

    if (user.isVerified) {
      req.flash("info", "Your email is already verified. Please log in.");
      return res.redirect("/login");
    }

    if (user.otpExpires && user.otpExpires > Date.now() - 60000) {
      req.flash("warning", "Please wait at least 1 minute before requesting a new OTP.");
      return res.redirect(`/verify-email?email=${user.email}`);
    }

    await sendVerificationOTP(user);

    req.flash("success", "A new verification code has been sent to your email.");
    res.redirect(`/verify-email?email=${user.email}`);
  } catch (err) {
    console.error("❌ OTP resend error:", err);
    req.flash("error", "Unable to send verification code. Please try again.");
    res.redirect(`/verify-email?email=${req.query.email || ""}`);
  }
};

// ================================================================
// PROFILE & ACCOUNT MANAGEMENT
// ================================================================

module.exports.profile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/");
    }

    // Fetch role-specific profile
    let paravetProfile = null;
    let farmerProfile = null;
    let salesProfile = null;

    if (user.role === 'PARAVET') {
      paravetProfile = await Paravet.findOne({ user: user._id })
        .populate('assignedFarmers')
        .populate('user');
      
      if (paravetProfile) {
        const totalVaccinations = await Vaccination.countDocuments({ 
          assignedParavet: paravetProfile._id,
          status: "Completed" 
        });
        paravetProfile = paravetProfile.toObject();
        paravetProfile.totalVaccinations = totalVaccinations || 0;
      }
    } else if (user.role === 'FARMER') {
      farmerProfile = await Farmer.findOne({ user: user._id })
        .populate('assignedParavet')
        .populate('assignedParavet.user')
        .populate('registeredBy');
      
      if (farmerProfile) {
        const vaccinationCount = await Vaccination.countDocuments({ 
          farmer: farmerProfile._id,
          status: "Completed" 
        });
        farmerProfile = farmerProfile.toObject();
        farmerProfile.vaccinationCount = vaccinationCount || 0;
      }
    } else if (user.role === 'SALES') {
      salesProfile = await SalesTeam.findOne({ user: user._id })
        .populate('onboardedFarmers')
        .populate('onboardedAnimals');
    }

    res.render('users/profile.ejs', {
      user: user,
      paravetProfile,
      farmerProfile,
      salesProfile,
      moment,
      title: 'My Profile'
    });

  } catch (err) {
    console.error("Profile error:", err);
    req.flash('error', 'Unable to load profile. Please try again.');
    res.redirect('/');
  }
};

module.exports.updateProfile = async (req, res) => {
  try {
    const { name, mobile, designation, qualification } = req.body;
    const userId = req.user._id;

    if (!name) {
      req.flash('warning', 'Name is required.');
      return res.redirect('/profile');
    }

    // Check if mobile is already used by another user
    if (mobile) {
      const existingUser = await User.findOne({
        mobile: mobile,
        _id: { $ne: userId }
      });
      if (existingUser) {
        req.flash('error', 'This mobile number is already in use.');
        return res.redirect('/profile');
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/profile');
    }

    // Update fields
    if (name) user.name = name.trim();
    if (mobile) user.mobile = mobile.trim();
    if (designation) user.designation = designation.trim();
    if (qualification) user.qualification = qualification.trim();

    await user.save();

    // If paravet, update paravet profile too
    if (user.role === 'PARAVET') {
      const paravet = await Paravet.findOne({ user: userId });
      if (paravet && qualification) {
        paravet.qualification = qualification.trim();
        await paravet.save();
      }
    }

    req.flash('success', 'Profile updated successfully!');
    res.redirect('/profile');

  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error', 'Failed to update profile: ' + error.message);
    res.redirect('/profile');
  }
};

// ================================================================
// CHANGE PASSWORD
// ================================================================

module.exports.renderChangePassword = (req, res) => {
  res.render('users/change-password', {
    title: 'Change Password',
    user: req.user
  });
};

module.exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user._id;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('warning', 'All fields are required.');
      return res.redirect('/change-password');
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match.');
      return res.redirect('/change-password');
    }

    if (newPassword.length < 8) {
      req.flash('error', 'Password must be at least 8 characters long.');
      return res.redirect('/change-password');
    }

    const user = await User.findById(userId);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/change-password');
    }

    // Verify current password using passport-local-mongoose
    const isValid = await user.authenticate(currentPassword);
    if (!isValid || !isValid.user) {
      req.flash('error', 'Current password is incorrect.');
      return res.redirect('/change-password');
    }

    // Set new password
    await user.setPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    await sendPasswordChangeConfirmation(user);

    req.flash('success', 'Password changed successfully! A confirmation email has been sent.');
    res.redirect('/profile');

  } catch (error) {
    console.error('Password change error:', error);
    req.flash('error', 'Failed to change password: ' + error.message);
    res.redirect('/change-password');
  }
};

// ================================================================
// ACCOUNT SETTINGS
// ================================================================

// controllers/users.js - Update renderSettings function

module.exports.renderSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get current theme from localStorage or default to 'system'
    // Since we can't access localStorage from server, we'll pass a default
    // and let the client-side JavaScript determine the actual theme
    const currentTheme = req.query.theme || 'system';
    
    res.render('users/settings.ejs', {
      title: 'Account Settings',
      user: user,
      currentTheme: currentTheme,
      moment
    });
  } catch (err) {
    console.error("Settings error:", err);
    req.flash('error', 'Unable to load settings.');
    res.redirect('/profile');
  }
};

module.exports.updateNotifications = async (req, res) => {
  try {
    const { emailNotifications, vaccinationReminders, smsNotifications, weeklyReports } = req.body;
    // You can add notification settings to user model if needed
    req.flash('success', 'Notification preferences updated successfully!');
    res.redirect('/profile/settings');
  } catch (err) {
    console.error("Notification update error:", err);
    req.flash('error', 'Failed to update preferences.');
    res.redirect('/profile/settings');
  }
};

module.exports.updateDisplaySettings = async (req, res) => {
  try {
    const { language } = req.body;
    req.flash('success', 'Display settings updated successfully!');
    res.redirect('/profile/settings');
  } catch (err) {
    console.error("Display settings error:", err);
    req.flash('error', 'Failed to update display settings.');
    res.redirect('/profile/settings');
  }
};

// ================================================================
// ACCOUNT MANAGEMENT (Danger Zone)
// ================================================================

module.exports.deactivateAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check if user has active animals/vaccinations (for farmers/paravets)
    if (req.user.role === "FARMER") {
      const farmer = await Farmer.findOne({ user: userId });
      if (farmer) {
        const animalCount = await Animal.countDocuments({ farmer: farmer._id, isActive: true });
        if (animalCount > 0) {
          req.flash("error", `Cannot deactivate account. You have ${animalCount} active animal(s). Please transfer or mark them inactive first.`);
          return res.redirect("/profile/settings");
        }
      }
    }

    if (req.user.role === "PARAVET") {
      const paravet = await Paravet.findOne({ user: userId });
      if (paravet) {
        const farmerCount = await Farmer.countDocuments({ assignedParavet: paravet._id, isActive: true });
        if (farmerCount > 0) {
          req.flash("error", `Cannot deactivate account. You have ${farmerCount} assigned farmer(s). Please reassign them first.`);
          return res.redirect("/profile/settings");
        }
      }
    }

    await User.findByIdAndUpdate(userId, { isActive: false });
    
    req.logout((err) => {
      if (err) return next(err);
      req.flash("success", "Your account has been deactivated. You can reactivate by logging in.");
      res.redirect("/login");
    });

  } catch (err) {
    console.error("Deactivation error:", err);
    req.flash("error", "Failed to deactivate account.");
    res.redirect("/profile/settings");
  }
};

module.exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check for dependencies
    if (req.user.role === "FARMER") {
      const farmer = await Farmer.findOne({ user: userId });
      if (farmer) {
        const animalCount = await Animal.countDocuments({ farmer: farmer._id, isActive: true });
        if (animalCount > 0) {
          req.flash("error", `Cannot delete account. You have ${animalCount} active animal(s). Please transfer or mark them inactive first.`);
          return res.redirect("/profile/settings");
        }
        await Farmer.findByIdAndDelete(farmer._id);
      }
    }

    if (req.user.role === "PARAVET") {
      const paravet = await Paravet.findOne({ user: userId });
      if (paravet) {
        const farmerCount = await Farmer.countDocuments({ assignedParavet: paravet._id, isActive: true });
        if (farmerCount > 0) {
          req.flash("error", `Cannot delete account. You have ${farmerCount} assigned farmer(s). Please reassign them first.`);
          return res.redirect("/profile/settings");
        }
        await Paravet.findByIdAndDelete(paravet._id);
      }
    }

    if (req.user.role === "SALES") {
      const sales = await SalesTeam.findOne({ user: userId });
      if (sales) {
        await SalesTeam.findByIdAndDelete(sales._id);
      }
    }

    await User.findByIdAndDelete(userId);
    
    req.logout((err) => {
      if (err) return next(err);
      req.flash("success", "Your account has been permanently deleted.");
      res.redirect("/");
    });

  } catch (err) {
    console.error("Delete account error:", err);
    req.flash("error", "Failed to delete account.");
    res.redirect("/profile/settings");
  }
};

// ================================================================
// FORGOT / RESET PASSWORD
// ================================================================

module.exports.renderForgotPassword = (req, res) => {
  res.render("users/forgot-password.ejs", { title: "Forgot Password" });
};

module.exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash("error", "No account found with this email address.");
      return res.redirect("/forgot-password");
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const domain = process.env.DOMAIN || "https://zoopito.in";
    const resetLink = `${domain}/reset-password?token=${token}&email=${email}`;

    // Send reset email
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Password | Zoopito</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; padding: 40px 0; color: #1a1a2e; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%); padding: 32px 40px; text-align: center; }
        .header h1 { color: white; font-size: 24px; margin: 0; }
        .body { padding: 40px; }
        .btn { display: inline-block; padding: 14px 44px; background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%); color: white !important; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 12px; }
        .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
        @media (max-width: 600px) { .body { padding: 24px 20px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐄 Zoopito</h1>
          <p style="color:rgba(255,255,255,0.8);">Reset Your Password</p>
        </div>
        <div class="body">
          <h2>Hello ${user.name || user.username}!</h2>
          <p>We received a request to reset your password for your Zoopito account.</p>
          <p>Click the button below to create a new password:</p>
          <div style="text-align:center; margin: 28px 0;">
            <a href="${resetLink}" class="btn">🔑 Reset Password</a>
          </div>
          <p style="font-size:13px; color:#64748b;">This link will expire in 1 hour.</p>
          <p style="font-size:13px; color:#64748b;">If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <div style="font-weight:700; color:#0f8150;">Zoopito</div>
          <div style="font-size:12px; color:#94a3b8;">Livestock Intelligence Platform</div>
        </div>
      </div>
    </body>
    </html>
    `;

    await apiInstance.sendTransacEmail({
      sender: { email: "support@zoopito.in", name: "Zoopito" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: "🔑 Reset Your Password | Zoopito",
      htmlContent: htmlContent,
    });

    req.flash("success", "Password reset link has been sent to your email.");
    res.redirect("/login");

  } catch (err) {
    console.error("Forgot password error:", err);
    req.flash("error", "Unable to send reset link. Please try again.");
    res.redirect("/forgot-password");
  }
};

module.exports.renderResetPassword = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      req.flash("error", "Invalid password reset link.");
      return res.redirect("/login");
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Password reset link has expired or is invalid.");
      return res.redirect("/login");
    }

    res.render("users/reset-password.ejs", {
      title: "Reset Password",
      token,
      email,
      user
    });

  } catch (err) {
    console.error("Render reset password error:", err);
    req.flash("error", "Invalid password reset link.");
    res.redirect("/login");
  }
};

module.exports.postResetPassword = async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password?token=${token}&email=${email}`);
    }

    if (password.length < 8) {
      req.flash("error", "Password must be at least 8 characters long.");
      return res.redirect(`/reset-password?token=${token}&email=${email}`);
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Password reset link has expired or is invalid.");
      return res.redirect("/login");
    }

    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Password has been reset successfully! Please login with your new password.");
    res.redirect("/login");

  } catch (err) {
    console.error("Post reset password error:", err);
    req.flash("error", "Unable to reset password. Please try again.");
    res.redirect(`/reset-password?token=${token}&email=${email}`);
  }
};
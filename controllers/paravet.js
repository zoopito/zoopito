const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Vaccination = require("../models/vaccination");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment");
const brevo = require("@getbrevo/brevo");

// Configure Brevo API
const brevoApi = new brevo.TransactionalEmailsApi();
brevoApi.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

// Employee ID Generator for Paravets
const generateEmployeeCode = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let exists = true;

  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await Paravet.exists({ employeeCode: code });
  }
  return code;
};

// Password Generator
const generateStrongPassword = () => {
  return crypto.randomBytes(9).toString("base64").slice(0, 12);
};

// Generate Password Setup Token
function generatePasswordSetupToken(user) {
  const token = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
}

// Send Welcome Email to Paravet
async function sendParavetWelcomeEmail(user, tempPassword, employeeCode, isNewUser) {
  const domain = process.env.DOMAIN || "https://zoopito.in";
  const loginUrl = `${domain}/login`;
  
  const setupToken = generatePasswordSetupToken(user);
  await user.save();
  
  const setupUrl = `${domain}/reset-password?token=${setupToken}&email=${user.email}&role=paravet`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Zoopito Paravet Team</title>
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
      }
      
      .content {
        padding: 40px;
      }
      
      .greeting {
        font-size: 24px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 20px;
      }
      
      .employee-card {
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 12px;
        padding: 25px;
        margin: 25px 0;
        border: 1px solid #0ea5e9;
      }
      
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #cbd5e1;
      }
      
      .info-label {
        font-weight: 600;
        color: #0f3b2c;
      }
      
      .info-value {
        color: #1e293b;
        font-family: monospace;
        font-size: 16px;
      }
      
      .temp-password {
        background-color: #fef3c7;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 25px 0;
        border-left: 4px solid #f59e0b;
      }
      
      .password-code {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #92400e;
        font-family: monospace;
        margin: 15px 0;
      }
      
      .cta-button {
        display: inline-block;
        background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
        color: white;
        padding: 14px 30px;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 600;
        margin: 20px 10px;
        text-align: center;
      }
      
      .security-notice {
        background-color: #fef2f2;
        border-left: 4px solid #ef4444;
        padding: 16px;
        border-radius: 8px;
        margin: 25px 0;
        font-size: 14px;
      }
      
      .footer {
        background-color: #f9fafb;
        padding: 30px 40px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
      }
      
      @media (max-width: 600px) {
        .content, .footer {
          padding: 30px 20px;
        }
        
        .cta-button {
          display: block;
          margin: 15px 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">Zoopito Paravet Team</div>
        <div style="font-size: 14px; opacity: 0.9;">Welcome Aboard! 🚀</div>
      </div>
      
      <div class="content">
        <div class="greeting">
          Welcome ${user.name || user.username}!
        </div>
        
        <p>We're excited to have you join the <strong>Zoopito Paravet Team</strong>. Your account has been successfully created.</p>
        
        <div class="employee-card">
          <div class="info-row">
            <span class="info-label">📧 Email:</span>
            <span class="info-value">${user.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">🆔 Employee Code:</span>
            <span class="info-value">${employeeCode}</span>
          </div>
          <div class="info-row">
            <span class="info-label">👤 Role:</span>
            <span class="info-value">Paravet - Veterinary Professional</span>
          </div>
          ${user.qualification ? `
          <div class="info-row">
            <span class="info-label">🎓 Qualification:</span>
            <span class="info-value">${user.qualification}</span>
          </div>
          ` : ''}
        </div>
        
        ${isNewUser ? `
        <div class="temp-password">
          <strong>🔐 Temporary Password</strong>
          <div class="password-code">${tempPassword}</div>
          <p style="margin-top: 10px; font-size: 14px; color: #78350f;">
            Use this temporary password to login for the first time.<br>
            You'll be required to set your own password using the link below.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" class="cta-button" style="background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%);">
            🔑 Login to Your Account
          </a>
          <a href="${setupUrl}" class="cta-button" style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);">
            ⚡ Set Your Password
          </a>
        </div>
        ` : `
        <div style="background-color: #dcfce7; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 25px 0;">
          <strong>✅ Account Updated</strong>
          <p style="margin-top: 8px;">Your account has been updated to Paravet role. You can continue using your existing password to login.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" class="cta-button">
            🔑 Access Your Account
          </a>
        </div>
        `}
        
        <div class="security-notice">
          <strong>🔒 Important Security Notice:</strong><br>
          • If you didn't request this account creation, please contact support immediately.<br>
          • Never share your password with anyone.<br>
          • Zoopito staff will never ask for your password.
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
          <p><strong>📋 Next Steps:</strong></p>
          <ol style="margin-top: 10px; padding-left: 20px;">
            <li>Login using your email and ${isNewUser ? 'temporary password' : 'existing password'}</li>
            ${isNewUser ? '<li>Click on "Set Your Password" to create your permanent password</li>' : ''}
            <li>Complete your profile information</li>
            <li>Familiarize yourself with the paravet dashboard</li>
            <li>Start managing assigned farmers and vaccinations</li>
          </ol>
        </div>
        
        <p style="margin-top: 25px; color: #4b5563;">
          Need help? Contact your supervisor or reach out to support:
          <br>
          📧 <a href="mailto:paravet-support@zoopito.in" style="color: #2563eb;">paravet-support@zoopito.in</a>
        </p>
      </div>
      
      <div class="footer">
        <p>
          <strong>Zoopito Paravet Team</strong><br>
          Udyam Registered • Delhi, India
        </p>
        <p style="margin-top: 15px; font-size: 12px;">
          This is an automated email. Please do not reply directly.<br>
          © ${new Date().getFullYear()} Zoopito. All rights reserved.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  const textContent = `
  WELCOME TO ZOOPITO PARAVET TEAM
  ================================
  
  Welcome ${user.name || user.username}!
  
  Your account has been successfully created.
  
  Employee Details:
  ---------------
  Email: ${user.email}
  Employee Code: ${employeeCode}
  Role: Paravet - Veterinary Professional
  
  ${isNewUser ? `
  TEMPORARY PASSWORD:
  ${tempPassword}
  
  Please use this temporary password to login for the first time.
  Click the "Set Your Password" link to create your permanent password.
  
  Password Setup Link: ${setupUrl}
  ` : ''}
  
  Login URL: ${loginUrl}
  
  Next Steps:
  1. Login using your email and ${isNewUser ? 'temporary password' : 'existing password'}
  ${isNewUser ? '2. Set your permanent password using the link above' : ''}
  3. Complete your profile information
  4. Start managing assigned farmers and vaccinations
  
  Security Notice:
  - Never share your password with anyone
  - Zoopito staff will never ask for your password
  - If you didn't request this, contact support immediately
  
  Need help? Contact: paravet-support@zoopito.in
  
  ---
  Zoopito Paravet Team
  © ${new Date().getFullYear()} Zoopito. All rights reserved.
  `;

  try {
    await brevoApi.sendTransacEmail({
      sender: { email: "paravet@zoopito.in", name: "Zoopito Paravet Team" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: isNewUser 
        ? "🎉 Welcome to Zoopito Paravet Team! Login Credentials Inside" 
        : "📋 Updated to Paravet Role",
      htmlContent: htmlContent,
      textContent: textContent,
    });

    console.log(`✅ Welcome email sent to paravet: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send email to ${user.email}:`, emailErr);
  }
}

// ================ ADMIN PARAVET MANAGEMENT ================

module.exports.paravetsindex = async (req, res) => {
  try {
    const paravets = await Paravet.find()
      .populate("user", "name email mobile role isActive")
      .sort({ createdAt: -1 });
    
    res.render("admin/paravets/index", { 
      paravets,
      title: "Manage Paravets - Zoopito Admin"
    });
  } catch (error) {
    console.error("Error fetching paravets:", error);
    req.flash("error", "Unable to fetch paravets at this time.");
    res.redirect("/admin/dashboard");
  }
};

module.exports.createParavetForm = async (req, res) => {
  try {
    res.render("paravet/new", {
      title: "Add New Paravet - Zoopito Admin"
    });
  } catch (error) {
    console.error("Error rendering create paravet form:", error);
    req.flash("error", "Unable to load form at this time.");
    res.redirect("/admin/paravets");
  }
};

module.exports.createParavet = async (req, res) => {
  try {
    const { userData, paravetData } = req.body;
    let isNewUser = false;
    let tempPassword = null;

    // 1️⃣ Find existing user
    let existingUser = await User.findOne({
      $or: [{ email: userData.email }, { mobile: userData.mobile }],
    });

    let finalUser;

    if (existingUser) {
      finalUser = existingUser;
      // Update role if not already PARAVET
      if (finalUser.role !== "PARAVET") {
        finalUser.role = "PARAVET";
        await finalUser.save();
      }
    } else {
      // 2️⃣ Create new user
      isNewUser = true;
      tempPassword = generateStrongPassword();

      const newUser = new User({
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile,
        role: "PARAVET",
        isActive: true,
        isVerified: true, // Auto-verify paravet team members
      });

      await User.register(newUser, tempPassword);
      finalUser = newUser;

      console.log(`✅ Temporary password for ${userData.email}: ${tempPassword}`);
    }

    // 3️⃣ Check if already paravet
    const alreadyParavet = await Paravet.findOne({
      user: finalUser._id,
    });

    if (alreadyParavet) {
      req.flash("error", "This user is already registered as a Paravet");
      return res.redirect("/admin/paravets");
    }

    // 4️⃣ Generate employee code
    const employeeCode = await generateEmployeeCode();

    // 5️⃣ Create Paravet profile
    const newParavet = new Paravet({
      user: finalUser._id,
      employeeCode,
      qualification: paravetData.qualification,
      licenseNumber: paravetData.licenseNumber || undefined,
      assignedAreas: paravetData.assignedAreas || [],
      isActive: paravetData.isActive === "on",
      specialization: paravetData.specialization,
      experience: paravetData.experience,
      registrationNumber: paravetData.registrationNumber,
    });

    await newParavet.save();

    // 6️⃣ Send welcome email
    await sendParavetWelcomeEmail(finalUser, tempPassword, employeeCode, isNewUser);

    req.flash(
      "success", 
      `Paravet created successfully. ${isNewUser ? 'Welcome email with temporary password sent.' : 'User added to paravet team.'}`
    );
    res.redirect("/admin/paravets");
  } catch (error) {
    console.error("Create Paravet Error:", error);

    if (error.code === 11000) {
      req.flash("error", "License number or employee code already exists");
      return res.redirect("/admin/paravets/new");
    }

    req.flash("error", "Failed to create Paravet: " + error.message);
    res.redirect("/admin/paravets/new");
  }
};

module.exports.viewParavet = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid Paravet ID");
      return res.redirect("/admin/paravets");
    }

    const paravet = await Paravet.findById(id)
      .populate("user", "name email mobile role isActive lastLogin")
      .populate("assignedFarmers", "name mobileNumber uniqueFarmerId address totalAnimals")
      .lean();

    if (!paravet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    // Get statistics
    const stats = {
      totalFarmers: paravet.assignedFarmers?.length || 0,
      totalVaccinations: await Vaccination.countDocuments({ assignedParavet: paravet._id }),
      completedVaccinations: await Vaccination.countDocuments({ 
        assignedParavet: paravet._id, 
        status: "Completed" 
      }),
      pendingVaccinations: await Vaccination.countDocuments({ 
        assignedParavet: paravet._id, 
        status: { $in: ["Scheduled", "Payment Pending"] } 
      }),
    };

    res.render("paravet/view", {
      paravet,
      stats,
      currentUser: req.user,
      title: `View Paravet - ${paravet.user.name}`
    });
  } catch (error) {
    console.error("View Paravet Error:", error);
    req.flash("error", "Unable to load paravet details");
    res.redirect("/admin/paravets");
  }
};

module.exports.renderEditForm = async (req, res) => {
  try {
    const { id } = req.params;

    const paravet = await Paravet.findById(id).populate("user");
    if (!paravet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    res.render("paravet/edit", { 
      paravet,
      title: `Edit Paravet - ${paravet.user.name}`
    });
  } catch (error) {
    console.error("Edit Paravet Error:", error);
    req.flash("error", "Unable to load paravet details");
    res.redirect("/admin/paravets");
  }
};

module.exports.updateParavet = async (req, res) => {
  try {
    const { id } = req.params;

    const { user, paravet } = req.body; // ✅ FIX

    console.log("BODY:", req.body); // debug

    const existingParavet = await Paravet.findById(id);
    if (!existingParavet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    // Update User
    await User.findByIdAndUpdate(existingParavet.user, {
      name: user.name,
      role: "PARAVET",
      email: user.email,
      mobile: user.mobile,
      isActive: paravet.isActive === "on",
    });

    // Update Paravet
    await Paravet.findByIdAndUpdate(
      id,
      {
        qualification: paravet.qualification,
        licenseNumber: paravet.licenseNumber,
        assignedAreas: paravet.assignedAreas,
        isActive: paravet.isActive === "on",
        specialization: paravet.specialization,
        experience: paravet.experience,
        registrationNumber: paravet.registrationNumber,
      },
      { runValidators: true }
    );

    req.flash("success", "Paravet updated successfully");
    res.redirect("/admin/paravets");

  } catch (error) {
    console.error("Update Paravet Error:", error);
    req.flash("error", "Failed to update paravet");
    res.redirect("/admin/paravets");
  }
};

module.exports.toggleParavetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    const paravet = await Paravet.findById(id);
    if (!paravet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    if (action === "activate") {
      paravet.isActive = true;
      await User.findByIdAndUpdate(paravet.user, { isActive: true });
    } else if (action === "deactivate") {
      paravet.isActive = false;
      await User.findByIdAndUpdate(paravet.user, { isActive: false });
    }

    await paravet.save();

    req.flash(
      "success",
      `Paravet ${paravet.isActive ? "activated" : "deactivated"} successfully`,
    );
    res.redirect("/admin/paravets");
  } catch (error) {
    console.error("Toggle Paravet Status Error:", error);
    req.flash("error", "Unable to update paravet status");
    res.redirect("/admin/paravets");
  }
};

module.exports.deleteParavet = async (req, res) => {
  try {
    const { id } = req.params;

    const paravet = await Paravet.findById(id);
    if (!paravet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    // Check if paravet has assigned farmers
    const assignedFarmersCount = await Farmer.countDocuments({ assignedParavet: paravet._id });
    if (assignedFarmersCount > 0) {
      req.flash("error", `Cannot delete paravet with ${assignedFarmersCount} assigned farmers. Reassign farmers first.`);
      return res.redirect("/admin/paravets");
    }

    // Delete linked user
    await User.findByIdAndDelete(paravet.user);
    
    // Delete paravet
    await Paravet.findByIdAndDelete(id);

    req.flash("success", "Paravet deleted permanently");
    res.redirect("/admin/paravets");
  } catch (error) {
    console.error("Delete Paravet Error:", error);
    req.flash("error", "Unable to delete paravet");
    res.redirect("/admin/paravets");
  }
};

// ================ PARAVET DASHBOARD ================

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get paravet details
    const paravet = await Paravet.findOne({ user: userId })
      .populate("user", "name email mobile")
      .populate("assignedFarmers", "name mobileNumber address totalAnimals");

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    // Get today's date range
    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");
    const weekStart = moment().startOf("week");
    const weekEnd = moment().endOf("week");

    // Get counts and stats
    const [
      totalFarmers,
      totalAnimals,
      todaySchedules,
      pendingVaccinations,
      completedToday,
      upcomingSchedules,
      completedThisWeek,
      totalCompleted,
      totalEarnings,
    ] = await Promise.all([
      Farmer.countDocuments({ assignedParavet: paravet._id, isActive: true }),
      Animal.countDocuments({
        farmer: { $in: paravet.assignedFarmers.map((f) => f._id) },
        isActive: true,
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        scheduledDate: {
          $gte: today.toDate(),
          $lte: tomorrow.toDate(),
        },
        status: "Scheduled",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        status: { $in: ["Scheduled", "Payment Pending"] },
        nextDueDate: { $lte: moment().add(7, "days").toDate() },
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        dateAdministered: {
          $gte: today.toDate(),
          $lte: tomorrow.toDate(),
        },
        status: "Completed",
      }),
      Vaccination.find({
        assignedParavet: paravet._id,
        status: "Scheduled",
        scheduledDate: { $gte: new Date() },
      })
        .populate("farmer", "name address mobileNumber")
        .populate("animal", "name tagNumber animalType")
        .populate("vaccine", "name")
        .sort({ scheduledDate: 1 })
        .limit(10)
        .lean(),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        dateAdministered: { $gte: weekStart.toDate(), $lte: weekEnd.toDate() },
        status: "Completed",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        status: "Completed",
      }),
      Vaccination.aggregate([
        { $match: { assignedParavet: paravet._id, status: "Completed" } },
        { $group: { _id: null, total: { $sum: "$payment.totalAmount" } } },
      ]),
    ]);

    // Get recent activities
    const recentActivities = await Vaccination.find({
      assignedParavet: paravet._id,
      dateAdministered: { $exists: true },
    })
      .populate("farmer", "name")
      .populate("animal", "name tagNumber")
      .populate("vaccine", "name")
      .sort({ dateAdministered: -1 })
      .limit(10)
      .lean();

    // Get performance metrics for last 30 days
    const thirtyDaysAgo = moment().subtract(30, "days").startOf("day").toDate();

    const performanceMetrics = await Vaccination.aggregate([
      {
        $match: {
          assignedParavet: paravet._id,
          dateAdministered: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$dateAdministered" },
            month: { $month: "$dateAdministered" },
            day: { $dayOfMonth: "$dateAdministered" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$payment.totalAmount" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
      { $limit: 30 },
    ]);

    // Get daily stats for chart
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, "days");
      const count = await Vaccination.countDocuments({
        assignedParavet: paravet._id,
        dateAdministered: {
          $gte: date.startOf("day").toDate(),
          $lte: date.endOf("day").toDate(),
        },
        status: "Completed",
      });
      dailyStats.push({
        date: date.format("DD MMM"),
        count,
      });
    }

    res.render("paravet/dashboard", {
      title: "Paravet Dashboard - Zoopito",
      farmName: "Zoopito",
      paravet,
      stats: {
        totalFarmers,
        totalAnimals,
        todaySchedules,
        pendingVaccinations,
        completedToday,
        upcomingSchedules: upcomingSchedules.length,
        totalCompleted,
        totalEarnings: totalEarnings[0]?.total || 0,
        completedThisWeek,
      },
      upcomingSchedules,
      recentActivities,
      performanceMetrics,
      dailyStats,
      moment,
      user: req.user,
    });
  } catch (error) {
    console.error("Error loading paravet dashboard:", error);
    req.flash("error", "Error loading dashboard");
    res.redirect("/login");
  }
};

// ================ PARAVET FARMER MANAGEMENT ================

exports.getFarmerList = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const farmers = await Farmer.find({
      assignedParavet: paravet._id,
      isActive: true,
    })
      .select("name mobileNumber address uniqueFarmerId totalAnimals")
      .sort({ name: 1 })
      .lean();

    // Get pending vaccinations count for each farmer
    const farmersWithStats = await Promise.all(
      farmers.map(async (farmer) => {
        const pendingCount = await Vaccination.countDocuments({
          farmer: farmer._id,
          status: { $in: ["Scheduled", "Payment Pending"] },
        });

        const lastVisit = await Vaccination.findOne({
          farmer: farmer._id,
          dateAdministered: { $exists: true },
        })
          .sort({ dateAdministered: -1 })
          .select("dateAdministered")
          .lean();

        return {
          ...farmer,
          pendingCount,
          lastVisit: lastVisit?.dateAdministered || null,
        };
      }),
    );

    res.render("paravet/farmers/index", {
      title: "My Farmers - Zoopito",
      farmers: farmersWithStats,
      paravet,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching farmers:", error);
    req.flash("error", "Error fetching farmers");
    res.redirect("/paravet/dashboard");
  }
};

exports.getFarmerAnimals = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.user._id;

    const paravet = await Paravet.findOne({ user: userId });

    // Verify farmer is assigned to this paravet
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true,
    }).populate("user", "name email mobile");

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    const animals = await Animal.find({
      farmer: farmerId,
      isActive: true,
    })
      .select("name tagNumber animalType breed age gender vaccinationSummary")
      .lean();

    // Get pending vaccinations for each animal
    const animalsWithVaccinations = await Promise.all(
      animals.map(async (animal) => {
        const pendingVaccinations = await Vaccination.find({
          animal: animal._id,
          status: { $in: ["Scheduled", "Payment Pending"] },
        })
          .populate("vaccine", "name diseaseTarget")
          .sort({ nextDueDate: 1 })
          .lean();

        const completedVaccinations = await Vaccination.countDocuments({
          animal: animal._id,
          status: "Completed",
        });

        const lastVaccination = await Vaccination.findOne({
          animal: animal._id,
          status: "Completed",
        })
          .sort({ dateAdministered: -1 })
          .populate("vaccine", "name")
          .lean();

        return {
          ...animal,
          pendingVaccinations,
          completedCount: completedVaccinations,
          hasPending: pendingVaccinations.length > 0,
          lastVaccination,
        };
      }),
    );

    res.render("paravet/farmers/animals", {
      title: `${farmer.name} - Animals`,
      farmer,
      animals: animalsWithVaccinations,
      paravet,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching farmer animals:", error);
    req.flash("error", "Error fetching animals");
    res.redirect("/paravet/farmers");
  }
};

// ================ PARAVET VACCINATION MANAGEMENT ================

exports.getPendingVaccinations = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const { filter } = req.query;
    const query = {
      assignedParavet: paravet._id,
      status: { $in: ["Scheduled", "Payment Pending"] },
    };

    if (filter === "today") {
      const today = moment().startOf("day");
      const tomorrow = moment().endOf("day");
      query.scheduledDate = { $gte: today.toDate(), $lte: tomorrow.toDate() };
    } else if (filter === "overdue") {
      query.nextDueDate = { $lt: new Date() };
    } else if (filter === "week") {
      const weekEnd = moment().add(7, "days").endOf("day");
      query.scheduledDate = { $lte: weekEnd.toDate() };
    }

    const vaccinations = await Vaccination.find(query)
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType age")
      .populate("vaccine", "name diseaseTarget")
      .sort({ scheduledDate: 1, nextDueDate: 1 })
      .lean();

    // Group by farmer
    const groupedByFarmer = {};
    vaccinations.forEach((vac) => {
      const farmerId = vac.farmer._id.toString();
      if (!groupedByFarmer[farmerId]) {
        groupedByFarmer[farmerId] = {
          farmer: vac.farmer,
          vaccinations: [],
        };
      }
      groupedByFarmer[farmerId].vaccinations.push(vac);
    });

    res.render("paravet/vaccinations/pending", {
      title: "Pending Vaccinations",
      groupedVaccinations: Object.values(groupedByFarmer),
      total: vaccinations.length,
      currentFilter: filter || "all",
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching pending vaccinations:", error);
    req.flash("error", "Error fetching pending vaccinations");
    res.redirect("/paravet/dashboard");
  }
};

exports.performVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      batchNumber,
      expiryDate,
      dosageAmount,
      administrationMethod,
      injectionSite,
      temperature,
      weight,
      notes,
      paymentReceived,
      paymentMethod,
    } = req.body;

    const vaccination = await Vaccination.findById(id)
      .populate("animal")
      .populate("farmer")
      .populate("vaccine");

    if (!vaccination) {
      req.flash("error", "Vaccination not found");
      return res.redirect("/paravet/vaccinations/pending");
    }

    // Update vaccination record
    vaccination.status = "Completed";
    vaccination.dateAdministered = new Date();
    vaccination.administeredBy = req.user.name;
    vaccination.batchNumber = batchNumber || vaccination.batchNumber;
    vaccination.expiryDate = expiryDate || vaccination.expiryDate;
    vaccination.dosageAmount = dosageAmount || vaccination.dosageAmount;
    vaccination.administrationMethod =
      administrationMethod || vaccination.administrationMethod;
    vaccination.injectionSite = injectionSite || vaccination.injectionSite;
    vaccination.notes = notes || vaccination.notes;

    // Update payment details
    if (paymentReceived) {
      vaccination.payment = {
        status: "Paid",
        totalAmount: vaccination.vaccine?.price || 0,
        amountPaid: vaccination.vaccine?.price || 0,
        paymentMethod: paymentMethod || "Cash",
        paymentDate: new Date(),
        transactionId: `TXN_${Date.now()}`,
      };
    }

    // Update animal condition if provided
    if (temperature || weight) {
      vaccination.animalCondition = {
        ...vaccination.animalCondition,
        temperature: temperature || vaccination.animalCondition?.temperature,
        weight: weight || vaccination.animalCondition?.weight,
        healthNotes: notes,
      };
    }

    await vaccination.save();

    // Update animal's vaccination summary
    await Animal.findByIdAndUpdate(vaccination.animal._id, {
      $set: {
        "vaccinationSummary.lastVaccinationDate": new Date(),
        "vaccinationSummary.lastVaccineType": vaccination.vaccine.name,
        "vaccinationSummary.isUpToDate": true,
        "vaccinationSummary.lastUpdated": new Date(),
      },
      $inc: { "vaccinationSummary.totalVaccinations": 1 },
      $push: {
        "vaccinationSummary.vaccinesGiven": {
          vaccine: vaccination.vaccine._id,
          vaccineName: vaccination.vaccine.name,
          date: new Date(),
          status: "completed",
          batchNumber: batchNumber,
        },
      },
    });

    req.flash("success", "Vaccination completed successfully");
    res.redirect("/paravet/vaccinations/pending");
  } catch (error) {
    console.error("Error performing vaccination:", error);
    req.flash("error", "Error performing vaccination");
    res.redirect("/paravet/vaccinations/pending");
  }
};

exports.getVaccinationForm = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const vaccination = await Vaccination.findById(id)
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType age breed")
      .populate("vaccine", "name diseaseTarget price dosage");

    if (!vaccination) {
      req.flash("error", "Vaccination not found");
      return res.redirect("/paravet/vaccinations/pending");
    }

    res.render("paravet/vaccinations/perform", {
      title: "Perform Vaccination",
      vaccination,
      paravet,
      user: req.user,
    });
  } catch (error) {
    console.error("Error loading vaccination form:", error);
    req.flash("error", "Error loading vaccination form");
    res.redirect("/paravet/vaccinations/pending");
  }
};

// ================ PARAVET REPORTS ================

exports.getDailyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const { date } = req.query;
    const reportDate = date ? moment(date) : moment();
    const startOfDay = reportDate.clone().startOf("day");
    const endOfDay = reportDate.clone().endOf("day");

    const vaccinations = await Vaccination.find({
      assignedParavet: paravet._id,
      dateAdministered: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() },
    })
      .populate("farmer", "name mobileNumber address")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name price")
      .sort({ dateAdministered: 1 })
      .lean();

    const summary = {
      total: vaccinations.length,
      byFarmer: {},
      byVaccine: {},
      totalEarnings: 0,
      paymentBreakdown: {
        cash: 0,
        online: 0,
        pending: 0,
      },
    };

    vaccinations.forEach((vac) => {
      // Group by farmer
      const farmerName = vac.farmer?.name || "Unknown";
      if (!summary.byFarmer[farmerName]) {
        summary.byFarmer[farmerName] = 0;
      }
      summary.byFarmer[farmerName]++;

      // Group by vaccine
      const vaccineName = vac.vaccine?.name || vac.vaccineName;
      if (!summary.byVaccine[vaccineName]) {
        summary.byVaccine[vaccineName] = 0;
      }
      summary.byVaccine[vaccineName]++;

      // Calculate earnings and payment breakdown
      const amount = vac.payment?.totalAmount || vac.vaccine?.price || 0;
      summary.totalEarnings += amount;

      if (vac.payment?.status === "Paid") {
        if (vac.payment?.paymentMethod === "Cash") {
          summary.paymentBreakdown.cash += amount;
        } else {
          summary.paymentBreakdown.online += amount;
        }
      } else {
        summary.paymentBreakdown.pending += amount;
      }
    });

    res.render("paravet/reports/daily", {
      title: "Daily Report",
      reportDate: reportDate.format("DD MMMM YYYY"),
      vaccinations,
      summary,
      moment,
      user: req.user,
    });
  } catch (error) {
    console.error("Error generating daily report:", error);
    req.flash("error", "Error generating report");
    res.redirect("/paravet/dashboard");
  }
};

exports.getWeeklyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const weekStart = moment().startOf("week");
    const weekEnd = moment().endOf("week");

    const vaccinations = await Vaccination.find({
      assignedParavet: paravet._id,
      dateAdministered: { $gte: weekStart.toDate(), $lte: weekEnd.toDate() },
    })
      .populate("farmer", "name")
      .populate("vaccine", "name price")
      .lean();

    // Group by day
    const daily = {};
    for (let i = 0; i < 7; i++) {
      const day = moment(weekStart).add(i, "days");
      const dayKey = day.format("YYYY-MM-DD");
      daily[dayKey] = {
        date: day.format("DD MMM"),
        dayName: day.format("dddd"),
        count: 0,
        earnings: 0,
        farmers: new Set(),
      };
    }

    vaccinations.forEach((vac) => {
      const dayKey = moment(vac.dateAdministered).format("YYYY-MM-DD");
      if (daily[dayKey]) {
        daily[dayKey].count++;
        daily[dayKey].earnings += vac.payment?.totalAmount || vac.vaccine?.price || 0;
        if (vac.farmer) {
          daily[dayKey].farmers.add(vac.farmer._id.toString());
        }
      }
    });

    const dailyData = Object.values(daily).map(day => ({
      ...day,
      uniqueFarmers: day.farmers.size,
    }));

    res.render("paravet/reports/weekly", {
      title: "Weekly Report",
      weekStart: weekStart.format("DD MMM"),
      weekEnd: weekEnd.format("DD MMM YYYY"),
      daily: dailyData,
      total: vaccinations.length,
      totalEarnings: dailyData.reduce((sum, day) => sum + day.earnings, 0),
      totalFarmersServed: new Set(vaccinations.map(v => v.farmer?._id?.toString())).size,
      user: req.user,
    });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    req.flash("error", "Error generating report");
    res.redirect("/paravet/dashboard");
  }
};

// ================ API ENDPOINTS ================

exports.getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    if (!paravet) {
      return res
        .status(404)
        .json({ success: false, message: "Paravet not found" });
    }

    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");
    const weekEnd = moment().add(7, "days").endOf("day");

    const [
      totalFarmers,
      totalAnimals,
      todaySchedules,
      weekSchedules,
      pendingVaccinations,
      completedToday,
      completedThisWeek,
      totalCompleted,
      totalEarnings,
    ] = await Promise.all([
      Farmer.countDocuments({ assignedParavet: paravet._id, isActive: true }),
      Animal.countDocuments({
        farmer: { $in: paravet.assignedFarmers },
        isActive: true,
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        scheduledDate: { $gte: today.toDate(), $lte: tomorrow.toDate() },
        status: "Scheduled",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        scheduledDate: { $gte: today.toDate(), $lte: weekEnd.toDate() },
        status: "Scheduled",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        status: { $in: ["Scheduled", "Payment Pending"] },
        nextDueDate: { $lte: weekEnd.toDate() },
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        dateAdministered: { $gte: today.toDate(), $lte: tomorrow.toDate() },
        status: "Completed",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        dateAdministered: { $gte: today.toDate(), $lte: weekEnd.toDate() },
        status: "Completed",
      }),
      Vaccination.countDocuments({
        assignedParavet: paravet._id,
        status: "Completed",
      }),
      Vaccination.aggregate([
        { $match: { assignedParavet: paravet._id, status: "Completed" } },
        { $group: { _id: null, total: { $sum: "$payment.totalAmount" } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        totalFarmers,
        totalAnimals,
        todaySchedules,
        weekSchedules,
        pendingVaccinations,
        completedToday,
        completedThisWeek,
        totalCompleted,
        totalEarnings: totalEarnings[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
};

exports.getUpcomingSchedules = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const schedules = await Vaccination.find({
      assignedParavet: paravet._id,
      status: "Scheduled",
      scheduledDate: { $gte: new Date() },
    })
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ scheduledDate: 1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      schedules,
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching schedules" });
  }
};

// ================ TASK MANAGEMENT ================

/**
 * Get all tasks for the current paravet
 * Tasks include: pending vaccinations, farmer visits, and other assignments
 */
exports.getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });
    const { filter = 'all' } = req.query; // Get filter from query params

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");

    // Build query based on filter
    let query = {
      assignedParavet: paravet._id,
    };

    if (filter === 'today') {
      query.scheduledDate = {
        $gte: today.toDate(),
        $lte: tomorrow.toDate()
      };
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    } else if (filter === 'overdue') {
      query.scheduledDate = { $lt: new Date() };
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    } else if (filter === 'completed') {
      query.status = "Completed";
    } else if (filter === 'upcoming') {
      query.scheduledDate = { $gt: tomorrow.toDate() };
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    } else {
      // 'all' - show pending tasks
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    }

    // Fetch vaccinations
    const vaccinations = await Vaccination.find(query)
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ scheduledDate: 1 })
      .lean();

    // Transform to task format
    const tasks = vaccinations.map(vaccination => ({
      id: vaccination._id,
      type: "vaccination",
      title: `Vaccinate ${vaccination.animal?.name || "Animal"}`,
      description: `${vaccination.vaccine?.name || vaccination.vaccineName} vaccination`,
      farmer: vaccination.farmer,
      animal: vaccination.animal,
      scheduledDate: vaccination.scheduledDate,
      priority: vaccination.scheduledDate <= new Date() ? "high" : 
                moment(vaccination.scheduledDate).isSame(today, "day") ? "medium" : "low",
      status: vaccination.status === "Completed" ? "completed" : "pending",
      location: vaccination.farmer?.address?.village || vaccination.farmer?.address,
      estimatedDuration: 30,
      createdAt: vaccination.createdAt
    }));

    // Group tasks by date
    const groupedTasks = {};
    
    tasks.forEach(task => {
      let dateKey;
      const taskDate = moment(task.scheduledDate);
      
      if (taskDate.isSame(today, "day")) {
        dateKey = "Today";
      } else if (taskDate.isSame(moment().add(1, "day"), "day")) {
        dateKey = "Tomorrow";
      } else if (taskDate.isBefore(today)) {
        dateKey = "Overdue";
      } else if (taskDate.isBefore(moment().add(7, "days"))) {
        dateKey = "This Week";
      } else {
        dateKey = taskDate.format("DD MMM YYYY");
      }
      
      if (!groupedTasks[dateKey]) {
        groupedTasks[dateKey] = [];
      }
      groupedTasks[dateKey].push(task);
    });

    // Sort groups
    const sortedGroups = {};
    const order = ["Overdue", "Today", "Tomorrow", "This Week"];
    order.forEach(key => {
      if (groupedTasks[key]) {
        sortedGroups[key] = groupedTasks[key];
      }
    });
    Object.keys(groupedTasks).forEach(key => {
      if (!order.includes(key)) {
        sortedGroups[key] = groupedTasks[key];
      }
    });

    const totalTasks = tasks.length;
    const todayTasks = tasks.filter(t => moment(t.scheduledDate).isSame(today, "day")).length;
    const upcomingTasks = tasks.filter(t => moment(t.scheduledDate).isAfter(today, "day") && t.status !== "completed").length;
    const overdueTasks = tasks.filter(t => moment(t.scheduledDate).isBefore(today, "day") && t.status !== "completed").length;

    res.render("paravet/tasks/index", {
      title: "My Tasks - Zoopito",
      groupedTasks: sortedGroups,
      totalTasks,
      todayTasks,
      upcomingTasks,
      overdueTasks,
      currentFilter: filter, // Pass the current filter to the view
      moment,
      user: req.user,
      paravet
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    req.flash("error", "Error fetching tasks");
    res.redirect("/paravet/dashboard");
  }
};

/**
 * Complete a specific task (vaccination or visit)
 * @param {string} id - Task ID (vaccination ID or visit ID)
 */
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { taskType, completionNotes } = req.body;

    if (taskType === "vaccination") {
      // Redirect to vaccination completion form
      req.flash("info", "Please complete the vaccination details");
      return res.redirect(`/paravet/vaccination/${id}/perform`);
    } else if (taskType === "visit") {
      // Handle farmer visit completion
      const visit = await Visit.findById(id);
      if (!visit) {
        req.flash("error", "Visit not found");
        return res.redirect("/paravet/tasks");
      }

      visit.status = "Completed";
      visit.completedAt = new Date();
      visit.completionNotes = completionNotes;
      await visit.save();

      req.flash("success", "Visit marked as completed");
      res.redirect("/paravet/tasks");
    } else {
      req.flash("error", "Invalid task type");
      res.redirect("/paravet/tasks");
    }
  } catch (error) {
    console.error("Error completing task:", error);
    req.flash("error", "Error completing task");
    res.redirect("/paravet/tasks");
  }
};

/**
 * Reschedule a task to a new date/time
 * @param {string} id - Task ID
 */
exports.rescheduleTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newTime, reason } = req.body;

    const newDateTime = moment(`${newDate} ${newTime}`).toDate();

    // Find the vaccination record
    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      req.flash("error", "Task not found");
      return res.redirect("/paravet/tasks");
    }

    // Update scheduled date
    vaccination.scheduledDate = newDateTime;
    vaccination.rescheduleReason = reason;
    vaccination.rescheduledAt = new Date();
    vaccination.rescheduledBy = req.user._id;

    await vaccination.save();

    // Optional: Send notification to farmer about reschedule
    // await sendRescheduleNotification(vaccination.farmer, vaccination);

    req.flash("success", `Task rescheduled to ${moment(newDateTime).format("DD MMM YYYY, hh:mm A")}`);
    res.redirect("/paravet/tasks");
  } catch (error) {
    console.error("Error rescheduling task:", error);
    req.flash("error", "Error rescheduling task");
    res.redirect("/paravet/tasks");
  }
};

// ================ FARMER VISIT MANAGEMENT ================

/**
 * Start a visit to a farmer (check-in)
 */
exports.startVisit = async (req, res) => {
  try {
    const { farmerId, visitType, notes } = req.body;
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    // Verify farmer is assigned to this paravet
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id
    });

    if (!farmer) {
      return res.status(404).json({ 
        success: false, 
        message: "Farmer not found or not assigned to you" 
      });
    }

    // Create visit record
    const Visit = require("../models/visit"); // You'll need to create this model
    const visit = new Visit({
      farmer: farmerId,
      paravet: paravet._id,
      visitType: visitType || "routine",
      status: "InProgress",
      startedAt: new Date(),
      notes: notes,
      location: {
        type: "Point",
        coordinates: [req.body.longitude, req.body.latitude]
      }
    });

    await visit.save();

    // Update farmer's last visit tracking
    await Farmer.findByIdAndUpdate(farmerId, {
      lastVisitStart: new Date(),
      currentVisitId: visit._id
    });

    res.json({
      success: true,
      message: "Visit started successfully",
      visitId: visit._id
    });
  } catch (error) {
    console.error("Error starting visit:", error);
    res.status(500).json({ success: false, message: "Error starting visit" });
  }
};

/**
 * Complete a farmer visit (check-out)
 */
exports.completeVisit = async (req, res) => {
  try {
    const { visitId, summary, animalsChecked, recommendations, followUpDate } = req.body;
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const Visit = require("../models/visit");
    const visit = await Visit.findOne({
      _id: visitId,
      paravet: paravet._id,
      status: "InProgress"
    });

    if (!visit) {
      return res.status(404).json({ 
        success: false, 
        message: "Active visit not found" 
      });
    }

    // Update visit record
    visit.status = "Completed";
    visit.completedAt = new Date();
    visit.summary = summary;
    visit.animalsChecked = animalsChecked;
    visit.recommendations = recommendations;
    visit.followUpDate = followUpDate ? new Date(followUpDate) : null;

    await visit.save();

    // Update farmer record
    await Farmer.findByIdAndUpdate(visit.farmer, {
      lastVisitCompleted: new Date(),
      lastVisitSummary: summary,
      nextFollowUp: followUpDate ? new Date(followUpDate) : null,
      $inc: { totalVisits: 1 }
    });

    // If follow-up scheduled, create a new vaccination task if needed
    if (followUpDate && recommendations.includes("vaccination")) {
      // Create follow-up vaccination task logic here
    }

    res.json({
      success: true,
      message: "Visit completed successfully"
    });
  } catch (error) {
    console.error("Error completing visit:", error);
    res.status(500).json({ success: false, message: "Error completing visit" });
  }
};

// ================ RECENT ACTIVITIES ================

/**
 * Get recent activities for the paravet dashboard
 * Returns last 10 completed vaccinations and visits
 */
exports.getRecentActivities = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    // Get recent completed vaccinations
    const recentVaccinations = await Vaccination.find({
      assignedParavet: paravet._id,
      status: "Completed"
    })
      .populate("farmer", "name")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name")
      .sort({ dateAdministered: -1 })
      .limit(5)
      .lean();

    // Transform vaccinations to activity format
    const vaccinationActivities = recentVaccinations.map(vac => ({
      id: vac._id,
      type: "vaccination",
      title: "Vaccination Completed",
      description: `${vac.vaccine?.name || vac.vaccineName} administered to ${vac.animal?.name || vac.animal?.tagNumber}`,
      farmerName: vac.farmer?.name,
      timestamp: vac.dateAdministered,
      status: "completed",
      icon: "vaccine"
    }));

    // Get recent visits (if Visit model exists)
    let visitActivities = [];
    try {
      const Visit = require("../models/visit");
      const recentVisits = await Visit.find({
        paravet: paravet._id,
        status: "Completed"
      })
        .populate("farmer", "name")
        .sort({ completedAt: -1 })
        .limit(5)
        .lean();

      visitActivities = recentVisits.map(visit => ({
        id: visit._id,
        type: "visit",
        title: "Farmer Visit Completed",
        description: visit.summary || "Routine visit completed",
        farmerName: visit.farmer?.name,
        timestamp: visit.completedAt,
        status: "completed",
        icon: "visit"
      }));
    } catch (err) {
      // Visit model might not exist yet
      console.log("Visit model not available");
    }

    // Combine and sort by timestamp
    const allActivities = [...vaccinationActivities, ...visitActivities]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    // If this is an API request
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        activities: allActivities
      });
    }

    // Otherwise render view
    res.render("paravet/activities/index", {
      title: "Recent Activities",
      activities: allActivities,
      user: req.user,
      moment
    });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    if (req.xhr) {
      res.status(500).json({ success: false, message: "Error fetching activities" });
    } else {
      req.flash("error", "Error fetching activities");
      res.redirect("/paravet/dashboard");
    }
  }
};

// ================ PERFORMANCE METRICS ================

/**
 * Get performance metrics for the paravet
 * Returns data for charts and analytics
 */
exports.getPerformanceMetrics = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });
    const { period = "month", startDate, endDate } = req.query;

    let dateRange = {};
    let groupFormat = {};

    // Set date range based on period
    switch (period) {
      case "week":
        dateRange = {
          start: moment().startOf("week").toDate(),
          end: moment().endOf("week").toDate()
        };
        groupFormat = { day: "%d" };
        break;
      case "month":
        dateRange = {
          start: moment().startOf("month").toDate(),
          end: moment().endOf("month").toDate()
        };
        groupFormat = { day: "%d" };
        break;
      case "quarter":
        dateRange = {
          start: moment().subtract(3, "months").startOf("month").toDate(),
          end: moment().toDate()
        };
        groupFormat = { week: "%W" };
        break;
      case "year":
        dateRange = {
          start: moment().startOf("year").toDate(),
          end: moment().endOf("year").toDate()
        };
        groupFormat = { month: "%m" };
        break;
      default:
        if (startDate && endDate) {
          dateRange = {
            start: new Date(startDate),
            end: new Date(endDate)
          };
        } else {
          dateRange = {
            start: moment().subtract(30, "days").toDate(),
            end: moment().toDate()
          };
        }
    }

    // Get vaccinations metrics
    const vaccinationMetrics = await Vaccination.aggregate([
      {
        $match: {
          assignedParavet: paravet._id,
          status: "Completed",
          dateAdministered: {
            $gte: dateRange.start,
            $lte: dateRange.end
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$dateAdministered" } }
          },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$payment.totalAmount", 0] } },
          uniqueFarmers: { $addToSet: "$farmer" }
        }
      },
      {
        $project: {
          date: "$_id.date",
          count: 1,
          revenue: 1,
          uniqueFarmersCount: { $size: "$uniqueFarmers" }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get vaccine distribution
    const vaccineDistribution = await Vaccination.aggregate([
      {
        $match: {
          assignedParavet: paravet._id,
          status: "Completed",
          dateAdministered: {
            $gte: dateRange.start,
            $lte: dateRange.end
          }
        }
      },
      {
        $group: {
          _id: { $ifNull: ["$vaccineName", "$vaccine.name"] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get animal type distribution
    const animalTypeDistribution = await Vaccination.aggregate([
      {
        $match: {
          assignedParavet: paravet._id,
          status: "Completed"
        }
      },
      {
        $lookup: {
          from: "animals",
          localField: "animal",
          foreignField: "_id",
          as: "animalData"
        }
      },
      { $unwind: "$animalData" },
      {
        $group: {
          _id: "$animalData.animalType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get daily average
    const daysInRange = moment(dateRange.end).diff(moment(dateRange.start), "days") + 1;
    const totalVaccinations = vaccinationMetrics.reduce((sum, m) => sum + m.count, 0);
    const dailyAverage = totalVaccinations / daysInRange;

    // Get farmer satisfaction metrics (if you have feedback model)
    let satisfactionRate = null;
    try {
      const Feedback = require("../models/feedback");
      const feedback = await Feedback.aggregate([
        {
          $match: {
            paravetId: paravet._id,
            createdAt: { $gte: dateRange.start }
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            totalFeedbacks: { $sum: 1 }
          }
        }
      ]);
      if (feedback.length > 0) {
        satisfactionRate = (feedback[0].avgRating / 5) * 100;
      }
    } catch (err) {
      console.log("Feedback model not available");
    }

    const metrics = {
      period,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      },
      summary: {
        totalVaccinations,
        totalRevenue: vaccinationMetrics.reduce((sum, m) => sum + m.revenue, 0),
        totalFarmersServed: new Set(
          vaccinationMetrics.flatMap(m => m.uniqueFarmers)
        ).size,
        dailyAverage: Math.round(dailyAverage * 10) / 10,
        satisfactionRate: satisfactionRate || null
      },
      daily: vaccinationMetrics,
      vaccineDistribution,
      animalTypeDistribution,
      trends: {
        bestDay: vaccinationMetrics.reduce((best, curr) => 
          curr.count > best.count ? curr : best, { count: 0, date: null }),
        bestWeek: null, // Calculate weekly trends if needed
        growthRate: null // Compare with previous period
      }
    };

    // If API request
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        metrics
      });
    }

    // Render view
    res.render("paravet/performance/index", {
      title: "Performance Metrics",
      metrics,
      period,
      user: req.user,
      moment
    });
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    if (req.xhr) {
      res.status(500).json({ success: false, message: "Error fetching metrics" });
    } else {
      req.flash("error", "Error fetching performance metrics");
      res.redirect("/paravet/dashboard");
    }
  }
};

// ================ MONTHLY REPORT ================

/**
 * Get monthly report for the paravet
 */
exports.getMonthlyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });
    const { month, year } = req.query;

    const reportMonth = month ? parseInt(month) : moment().month() + 1;
    const reportYear = year ? parseInt(year) : moment().year();

    const startOfMonth = moment()
      .year(reportYear)
      .month(reportMonth - 1)
      .startOf("month");
    const endOfMonth = moment()
      .year(reportYear)
      .month(reportMonth - 1)
      .endOf("month");

    // Get all completed vaccinations for the month
    const vaccinations = await Vaccination.find({
      assignedParavet: paravet._id,
      status: "Completed",
      dateAdministered: {
        $gte: startOfMonth.toDate(),
        $lte: endOfMonth.toDate()
      }
    })
      .populate("farmer", "name mobileNumber address")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name price")
      .sort({ dateAdministered: 1 })
      .lean();

    // Calculate monthly summary
    const summary = {
      totalVaccinations: vaccinations.length,
      totalRevenue: vaccinations.reduce((sum, v) => sum + (v.payment?.totalAmount || 0), 0),
      totalFarmers: new Set(vaccinations.map(v => v.farmer?._id?.toString())).size,
      totalAnimals: new Set(vaccinations.map(v => v.animal?._id?.toString())).size,
      byVaccineType: {},
      weeklyBreakdown: {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
        week5: 0
      },
      paymentMode: {
        cash: 0,
        online: 0,
        pending: 0
      }
    };

    // Process vaccinations for breakdowns
    vaccinations.forEach(vac => {
      // Vaccine type breakdown
      const vaccineName = vac.vaccine?.name || vac.vaccineName;
      summary.byVaccineType[vaccineName] = (summary.byVaccineType[vaccineName] || 0) + 1;

      // Weekly breakdown
      const weekNumber = moment(vac.dateAdministered).isoWeek();
      const weekOfMonth = Math.ceil(moment(vac.dateAdministered).date() / 7);
      summary.weeklyBreakdown[`week${weekOfMonth}`]++;

      // Payment mode breakdown
      if (vac.payment?.status === "Paid") {
        if (vac.payment?.paymentMethod === "Cash") {
          summary.paymentMode.cash += vac.payment.totalAmount || 0;
        } else {
          summary.paymentMode.online += vac.payment.totalAmount || 0;
        }
      } else {
        summary.paymentMode.pending += vac.payment?.totalAmount || 0;
      }
    });

    // Get previous month data for comparison
    const previousMonthStart = moment(startOfMonth).subtract(1, "month");
    const previousMonthEnd = moment(endOfMonth).subtract(1, "month");
    const previousMonthVaccinations = await Vaccination.countDocuments({
      assignedParavet: paravet._id,
      status: "Completed",
      dateAdministered: {
        $gte: previousMonthStart.toDate(),
        $lte: previousMonthEnd.toDate()
      }
    });

    const comparison = {
      vaccinationsChange: previousMonthVaccinations 
        ? ((summary.totalVaccinations - previousMonthVaccinations) / previousMonthVaccinations * 100).toFixed(1)
        : 100,
      // Add more comparison metrics as needed
    };

    // If API request
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        report: {
          month: reportMonth,
          year: reportYear,
          summary,
          vaccinations,
          comparison,
          daily: Object.entries(
            vaccinations.reduce((acc, v) => {
              const date = moment(v.dateAdministered).format("YYYY-MM-DD");
              acc[date] = (acc[date] || 0) + 1;
              return acc;
            }, {})
          ).map(([date, count]) => ({ date, count }))
        }
      });
    }

    // Render view
    res.render("paravet/reports/monthly", {
      title: `Monthly Report - ${startOfMonth.format("MMMM YYYY")}`,
      reportMonth: startOfMonth.format("MMMM"),
      reportYear,
      summary,
      vaccinations,
      comparison,
      month: reportMonth,
      year: reportYear,
      moment,
      user: req.user,
      paravet
    });
  } catch (error) {
    console.error("Error generating monthly report:", error);
    req.flash("error", "Error generating monthly report");
    res.redirect("/paravet/dashboard");
  }
};

// ================ BULK VACCINATION ================

/**
 * Perform bulk vaccinations for multiple animals
 */
exports.bulkPerformVaccinations = async (req, res) => {
  try {
    const { vaccinationIds, vaccinationData } = req.body;
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    if (!vaccinationIds || vaccinationIds.length === 0) {
      req.flash("error", "No vaccinations selected");
      return res.redirect("/paravet/vaccinations/pending");
    }

    const results = {
      success: [],
      failed: []
    };

    for (const vacId of vaccinationIds) {
      try {
        const vaccination = await Vaccination.findById(vacId)
          .populate("animal")
          .populate("farmer")
          .populate("vaccine");

        if (!vaccination) {
          results.failed.push({ id: vacId, reason: "Vaccination not found" });
          continue;
        }

        // Update vaccination record
        vaccination.status = "Completed";
        vaccination.dateAdministered = new Date();
        vaccination.administeredBy = req.user.name;
        vaccination.batchNumber = vaccinationData.batchNumber;
        vaccination.expiryDate = vaccinationData.expiryDate;
        vaccination.dosageAmount = vaccinationData.dosageAmount;
        vaccination.administrationMethod = vaccinationData.administrationMethod;
        vaccination.notes = vaccinationData.notes;

        // Update payment details if provided
        if (vaccinationData.paymentReceived) {
          vaccination.payment = {
            status: "Paid",
            totalAmount: vaccination.vaccine?.price || 0,
            amountPaid: vaccination.vaccine?.price || 0,
            paymentMethod: vaccinationData.paymentMethod || "Cash",
            paymentDate: new Date(),
            transactionId: `BULK_${Date.now()}_${vacId}`
          };
        }

        await vaccination.save();

        // Update animal's vaccination summary
        await Animal.findByIdAndUpdate(vaccination.animal._id, {
          $set: {
            "vaccinationSummary.lastVaccinationDate": new Date(),
            "vaccinationSummary.lastVaccineType": vaccination.vaccine.name,
            "vaccinationSummary.lastUpdated": new Date()
          },
          $inc: { "vaccinationSummary.totalVaccinations": 1 },
          $push: {
            "vaccinationSummary.vaccinesGiven": {
              vaccine: vaccination.vaccine._id,
              vaccineName: vaccination.vaccine.name,
              date: new Date(),
              status: "completed",
              batchNumber: vaccinationData.batchNumber
            }
          }
        });

        results.success.push({ id: vacId, name: vaccination.animal?.name || vacId });
      } catch (error) {
        console.error(`Error processing vaccination ${vacId}:`, error);
        results.failed.push({ id: vacId, reason: error.message });
      }
    }

    req.flash(
      "success",
      `Bulk vaccination completed: ${results.success.length} successful, ${results.failed.length} failed`
    );
    
    if (req.xhr) {
      return res.json({ success: true, results });
    }
    
    res.redirect("/paravet/vaccinations/pending");
  } catch (error) {
    console.error("Error in bulk vaccination:", error);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: "Error performing bulk vaccination" });
    }
    req.flash("error", "Error performing bulk vaccination");
    res.redirect("/paravet/vaccinations/pending");
  }
};
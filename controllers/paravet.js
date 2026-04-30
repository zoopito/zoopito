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
      moment: moment,  // ✅ ADD THIS LINE - Pass moment to the view
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

/**
 * Complete a specific task (vaccination or visit)
 * @param {string} id - Task ID (vaccination ID or visit ID)
 

/**
 * Reschedule a task to a new date/time
 * @param {string} id - Task ID
 */

// ================ GET VACCINATION FORM FOR COMPLETION ================
exports.getVaccinationCompletionForm = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const vaccination = await Vaccination.findById(id)
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType age breed")
      .populate("vaccine", "name diseaseTarget defaultNextDueMonths boosterIntervalWeeks");

    if (!vaccination) {
      req.flash("error", "Vaccination not found");
      return res.redirect("/paravet/tasks");
    }

    res.render("paravet/vaccinations/complete", {
      title: "Complete Vaccination",
      vaccination,
      paravet,
      user: req.user,
      moment
    });
  } catch (error) {
    console.error("Error loading vaccination completion form:", error);
    req.flash("error", "Error loading form");
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

// ================ VIEW PARAVET ASSIGNMENTS ================
exports.paravetAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        
        const paravet = await Paravet.findById(id)
            .populate("user", "name email mobile")
            .lean();
        
        if (!paravet) {
            req.flash("error", "Paravet not found");
            return res.redirect("/admin/paravets");
        }
        
        // Get all tasks assigned to this paravet
        const tasks = await Vaccination.find({ assignedParavet: id })
            .populate("farmer", "name address mobileNumber")
            .populate("animal", "name tagNumber animalType")
            .populate("vaccine", "name")
            .sort({ scheduledDate: -1, createdAt: -1 })
            .lean();
        
        // Calculate stats
        const stats = {
            total: tasks.length,
            scheduled: tasks.filter(t => t.status === "Scheduled").length,
            completed: tasks.filter(t => t.status === "Completed").length,
            pending: tasks.filter(t => t.status === "Payment Pending").length,
            overdue: tasks.filter(t => t.scheduledDate && new Date(t.scheduledDate) < new Date() && t.status !== "Completed").length
        };
        
        // Get all paravets for reassign dropdown
        const paravetsList = await Paravet.find({ isActive: true })
            .populate("user", "name")
            .lean();
        
        res.render("admin/paravets/assignments", {
            title: `${paravet.user.name} - Task Assignments`,
            paravet,
            tasks,
            stats,
            paravetsList,
            moment
        });
    } catch (error) {
        console.error("Error viewing paravet assignments:", error);
        req.flash("error", "Error loading assignments");
        res.redirect("/admin/paravets");
    }
};

// ================ FILTER PARAVET ASSIGNMENTS ================
exports.filterParavetAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, fromDate, toDate } = req.query;
        
        let query = { assignedParavet: id };
        
        if (status && status !== 'all') {
            if (status === 'overdue') {
                query.scheduledDate = { $lt: new Date() };
                query.status = { $ne: "Completed" };
            } else if (status === 'scheduled') {
                query.status = "Scheduled";
            } else if (status === 'completed') {
                query.status = "Completed";
            } else if (status === 'pending') {
                query.status = "Payment Pending";
            }
        }
        
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59);
            query.scheduledDate = { $gte: startDate, $lte: endDate };
        } else if (fromDate) {
            const startDate = new Date(fromDate);
            query.scheduledDate = { $gte: startDate };
        } else if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59);
            query.scheduledDate = { $lte: endDate };
        }
        
        const tasks = await Vaccination.find(query)
            .populate("farmer", "name address")
            .populate("animal", "name tagNumber")
            .populate("vaccine", "name")
            .sort({ scheduledDate: -1 })
            .lean();
        
        res.json({ success: true, tasks });
    } catch (error) {
        console.error("Error filtering assignments:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================ REASSIGN TASK ================
exports.reassignTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { paravetId, scheduledDate } = req.body;
        
        const vaccination = await Vaccination.findByIdAndUpdate(id, {
            assignedParavet: paravetId,
            scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
            status: "Scheduled",
            updatedBy: req.user._id
        }, { new: true });
        
        if (!vaccination) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        
        res.json({ success: true, message: "Task reassigned successfully" });
    } catch (error) {
        console.error("Error reassigning task:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================ UNASSIGN TASK ================
exports.unassignTask = async (req, res) => {
    try {
        const { id } = req.params;
        
        const vaccination = await Vaccination.findByIdAndUpdate(id, {
            $unset: { assignedParavet: "" },
            updatedBy: req.user._id
        }, { new: true });
        
        if (!vaccination) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }
        
        res.json({ success: true, message: "Task unassigned successfully" });
    } catch (error) {
        console.error("Error unassigning task:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================ EXPORT PARAVET ASSIGNMENTS ================
exports.exportParavetAssignments = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, fromDate, toDate } = req.query;
        
        let query = { assignedParavet: id };
        
        if (status && status !== 'all') {
            if (status === 'overdue') {
                query.scheduledDate = { $lt: new Date() };
                query.status = { $ne: "Completed" };
            } else if (status === 'scheduled') {
                query.status = "Scheduled";
            } else if (status === 'completed') {
                query.status = "Completed";
            }
        }
        
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59);
            query.scheduledDate = { $gte: startDate, $lte: endDate };
        }
        
        const tasks = await Vaccination.find(query)
            .populate("farmer", "name address mobileNumber")
            .populate("animal", "name tagNumber animalType")
            .populate("vaccine", "name")
            .lean();
        
        const json2csv = require('json2csv').Parser;
        const fields = [
            "Farmer Name", "Farmer Mobile", "Farmer Village",
            "Animal Name", "Animal Tag", "Animal Type",
            "Vaccine Name", "Batch Number", "Scheduled Date",
            "Date Administered", "Next Due Date", "Status"
        ];
        
        const data = tasks.map(t => ({
            "Farmer Name": t.farmer?.name || "N/A",
            "Farmer Mobile": t.farmer?.mobileNumber || "N/A",
            "Farmer Village": t.farmer?.address?.village || "N/A",
            "Animal Name": t.animal?.name || "N/A",
            "Animal Tag": t.animal?.tagNumber || "N/A",
            "Animal Type": t.animal?.animalType || "N/A",
            "Vaccine Name": t.vaccine?.name || t.vaccineName,
            "Batch Number": t.batchNumber || "N/A",
            "Scheduled Date": t.scheduledDate ? moment(t.scheduledDate).format("DD/MM/YYYY") : "N/A",
            "Date Administered": t.dateAdministered ? moment(t.dateAdministered).format("DD/MM/YYYY") : "N/A",
            "Next Due Date": t.nextDueDate ? moment(t.nextDueDate).format("DD/MM/YYYY") : "N/A",
            "Status": t.status
        }));
        
        const parser = new json2csv({ fields });
        const csv = parser.parse(data);
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=paravet-tasks-${moment().format("YYYY-MM-DD")}.csv`);
        res.send(csv);
    } catch (error) {
        console.error("Error exporting assignments:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================ HELPER: GET RECOMMENDED VACCINATIONS ================

async function getRecommendedVaccinations(animal) {
  try {
    // Get all active vaccines
    const allVaccines = await Vaccine.find({ isActive: true });
    
    // Define vaccination schedule based on animal type and age
    const schedules = {
      Cow: {
        mandatory: ["FMD", "HS", "BQ"],
        optional: ["Theileriosis", "Brucellosis", "IBR"],
        schedule: [
          { vaccine: "FMD", dueAgeMonths: 4, boosterAfterMonths: 6 },
          { vaccine: "HS", dueAgeMonths: 6, boosterAfterMonths: 12 },
          { vaccine: "BQ", dueAgeMonths: 6, boosterAfterMonths: 12 },
          { vaccine: "Theileriosis", dueAgeMonths: 8, boosterAfterMonths: 12 }
        ]
      },
      Buffalo: {
        mandatory: ["FMD", "HS", "BQ"],
        optional: ["Theileriosis", "Brucellosis"],
        schedule: [
          { vaccine: "FMD", dueAgeMonths: 4, boosterAfterMonths: 6 },
          { vaccine: "HS", dueAgeMonths: 6, boosterAfterMonths: 12 },
          { vaccine: "BQ", dueAgeMonths: 6, boosterAfterMonths: 12 }
        ]
      },
      Goat: {
        mandatory: ["PPR", "FMD", "Enterotoxemia"],
        optional: ["Goat Pox", "Orf"],
        schedule: [
          { vaccine: "PPR", dueAgeMonths: 4, boosterAfterMonths: 12 },
          { vaccine: "FMD", dueAgeMonths: 4, boosterAfterMonths: 6 },
          { vaccine: "Enterotoxemia", dueAgeMonths: 4, boosterAfterMonths: 6 }
        ]
      },
      Sheep: {
        mandatory: ["PPR", "FMD", "Enterotoxemia"],
        optional: ["Sheep Pox"],
        schedule: [
          { vaccine: "PPR", dueAgeMonths: 4, boosterAfterMonths: 12 },
          { vaccine: "FMD", dueAgeMonths: 4, boosterAfterMonths: 6 },
          { vaccine: "Enterotoxemia", dueAgeMonths: 4, boosterAfterMonths: 6 }
        ]
      },
      Dog: {
        mandatory: ["Rabies", "DHPP"],
        optional: ["Leptospirosis", "Kennel Cough"],
        schedule: [
          { vaccine: "DHPP", dueAgeMonths: 2, boosterAfterMonths: 12 },
          { vaccine: "Rabies", dueAgeMonths: 3, boosterAfterMonths: 12 }
        ]
      },
      Cat: {
        mandatory: ["Rabies", "FVRCP"],
        optional: ["Feline Leukemia"],
        schedule: [
          { vaccine: "FVRCP", dueAgeMonths: 2, boosterAfterMonths: 12 },
          { vaccine: "Rabies", dueAgeMonths: 3, boosterAfterMonths: 12 }
        ]
      }
    };
    
    const animalSchedule = schedules[animal.animalType];
    if (!animalSchedule) return [];
    
    // Calculate age in months
    let ageInMonths = 0;
    if (animal.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(animal.dateOfBirth);
      ageInMonths = (today.getFullYear() - birthDate.getFullYear()) * 12;
      ageInMonths += today.getMonth() - birthDate.getMonth();
    } else if (animal.age?.value) {
      if (animal.age.unit === "Years") ageInMonths = animal.age.value * 12;
      else if (animal.age.unit === "Months") ageInMonths = animal.age.value;
      else if (animal.age.unit === "Days") ageInMonths = animal.age.value / 30;
    }
    
    // Get existing vaccinations for this animal
    const existingVaccinations = await Vaccination.find({
      animal: animal._id,
      status: { $in: ["Administered", "Completed", "Payment Verified"] }
    }).populate("vaccine");
    
    const existingVaccineNames = existingVaccinations.map(v => 
      v.vaccine?.name || v.vaccineName
    );
    
    // Determine recommended vaccines based on age and schedule
    const recommended = [];
    
    for (const vaccine of allVaccines) {
      const vaccineName = vaccine.name;
      
      // Skip if already given
      if (existingVaccineNames.includes(vaccineName)) continue;
      
      // Check if it's mandatory or optional
      const isMandatory = animalSchedule.mandatory.some(m => 
        vaccineName.toLowerCase().includes(m.toLowerCase())
      );
      const isOptional = animalSchedule.optional.some(o => 
        vaccineName.toLowerCase().includes(o.toLowerCase())
      );
      
      if (!isMandatory && !isOptional) continue;
      
      // Check if animal is old enough for this vaccine
      const scheduleItem = animalSchedule.schedule.find(s => 
        vaccineName.toLowerCase().includes(s.vaccine.toLowerCase())
      );
      
      if (scheduleItem) {
        if (ageInMonths >= scheduleItem.dueAgeMonths) {
          recommended.push(vaccine);
        }
      } else if (isMandatory) {
        // If no specific schedule but mandatory, recommend if animal is at least 3 months old
        if (ageInMonths >= 3) {
          recommended.push(vaccine);
        }
      }
    }
    
    return recommended;
    
  } catch (error) {
    console.error("Error getting recommended vaccinations:", error);
    return [];
  }
}


// ================ BULK VACCINATION FOR FARMER ================

exports.getBulkVaccinationForm = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    // Verify farmer is assigned
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true
    });

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    // Get all animals for this farmer
    const animals = await Animal.find({ farmer: farmerId, isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get all active vaccines
    const vaccines = await Vaccine.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get existing vaccinations for each animal
    const animalsWithVaccinations = await Promise.all(animals.map(async (animal) => {
      const existingVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Administered", "Completed", "Payment Verified"] }
      }).distinct("vaccine");
      
      const pendingVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      }).populate("vaccine", "name");
      
      return {
        ...animal,
        existingVaccineIds: existingVaccinations.map(id => id.toString()),
        pendingVaccinations: pendingVaccinations
      };
    }));

    res.render("paravet/vaccinations/bulk", {
      title: `Bulk Vaccination - ${farmer.name}`,
      farmer,
      animals: animalsWithVaccinations,
      vaccines,
      paravet,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading bulk vaccination form:", error);
    req.flash("error", "Error loading form");
    res.redirect(`/paravet/farmers/${req.params.farmerId}`);
  }
};

// ================ SUBMIT BULK VACCINATION ================

exports.submitBulkVaccination = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { vaccinations, commonDate, commonBatchNumber, commonNotes } = req.body;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    // Verify farmer is assigned
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true
    });

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    const results = {
      success: [],
      failed: [],
      updated: []
    };

    // Process each vaccination entry
    for (const [animalId, vaccineData] of Object.entries(vaccinations || {})) {
      const animal = await Animal.findById(animalId);
      if (!animal) continue;
      
      for (const [vaccineId, data] of Object.entries(vaccineData)) {
        if (!data.administered || data.administered !== "on") continue;
        
        try {
          const vaccine = await Vaccine.findById(vaccineId);
          if (!vaccine) continue;
          
          const adminDate = commonDate || data.dateAdministered || new Date();
          const batchNumber = commonBatchNumber || data.batchNumber || "";
          
          // Calculate next due date
          let nextDueDate = new Date(adminDate);
          if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
            nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
          } else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
          } else {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          }
          
          // Check if vaccination record already exists
          let vaccination = await Vaccination.findOne({
            animal: animalId,
            vaccine: vaccineId,
            status: { $in: ["Scheduled", "Payment Pending", "Administered"] }
          });
          
          if (vaccination) {
            // Update existing record
            vaccination.status = "Administered";
            vaccination.dateAdministered = adminDate;
            vaccination.nextDueDate = nextDueDate;
            vaccination.administeredBy = req.user.name;
            vaccination.batchNumber = batchNumber;
            vaccination.notes = commonNotes || data.notes || "";
            vaccination.verifiedBy = userId;
            vaccination.verifiedAt = new Date();
            vaccination.verificationStatus = "Verified";
            await vaccination.save();
            results.updated.push({ animal: animal.name, vaccine: vaccine.name });
          } else {
            // Create new record
            vaccination = new Vaccination({
              farmer: farmerId,
              animal: animalId,
              vaccine: vaccineId,
              vaccineName: vaccine.name,
              vaccineType: vaccine.vaccineType,
              doseNumber: 1,
              totalDosesRequired: 1,
              dateAdministered: adminDate,
              nextDueDate: nextDueDate,
              administeredBy: req.user.name,
              batchNumber: batchNumber,
              notes: commonNotes || data.notes || "",
              status: "Administered",
              verificationStatus: "Verified",
              verifiedBy: userId,
              verifiedAt: new Date(),
              createdBy: userId,
              payment: {
                vaccinePrice: vaccine.vaccineCharge || 0,
                serviceCharge: 0,
                totalAmount: vaccine.vaccineCharge || 0,
                paymentStatus: "Completed",
                paymentMethod: "Cash"
              }
            });
            await vaccination.save();
            results.success.push({ animal: animal.name, vaccine: vaccine.name });
          }
          
          // Update animal's vaccination summary
          await updateAnimalVaccinationSummary(animalId);
          
        } catch (error) {
          console.error(`Error processing vaccination for animal ${animalId}, vaccine ${vaccineId}:`, error);
          results.failed.push({ animalId, vaccineId, error: error.message });
        }
      }
    }
    
    // Create success message
    let message = "";
    if (results.success.length > 0) {
      message += `${results.success.length} new vaccinations recorded. `;
    }
    if (results.updated.length > 0) {
      message += `${results.updated.length} vaccinations updated. `;
    }
    if (results.failed.length > 0) {
      message += `${results.failed.length} failed.`;
    }
    
    req.flash("success", message || "Vaccination completed successfully!");
    res.redirect(`/paravet/farmers/${farmerId}`);
    
  } catch (error) {
    console.error("Error submitting bulk vaccination:", error);
    req.flash("error", "Error processing vaccinations: " + error.message);
    res.redirect(`/paravet/farmers/${req.params.farmerId}/vaccinate`);
  }
};


// ================ GET ANIMALS NEEDING VACCINATION ================

exports.getAnimalsNeedingVaccination = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    const assignedFarmerIds = paravet.assignedFarmers.map(f => f._id);
    
    const animals = await Animal.find({
      farmer: { $in: assignedFarmerIds },
      isActive: true
    })
      .populate("farmer", "name mobileNumber address")
      .lean();
    
    const animalsWithRecommendations = await Promise.all(animals.map(async (animal) => {
      const recommendedVaccines = await getRecommendedVaccinations(animal);
      const existingVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Administered", "Completed"] }
      }).distinct("vaccine");
      
      const existingVaccineIds = existingVaccinations.map(id => id.toString());
      const pendingRecommended = recommendedVaccines.filter(v => 
        !existingVaccineIds.includes(v._id.toString())
      );
      
      return {
        ...animal,
        recommendedVaccines: pendingRecommended,
        needsVaccination: pendingRecommended.length > 0,
        needsTagging: !animal.tagNumber,
        vaccinationCount: existingVaccinations.length
      };
    }));
    
    const needingVaccination = animalsWithRecommendations.filter(a => a.needsVaccination);
    const needingTagging = animalsWithRecommendations.filter(a => a.needsTagging);
    
    res.render("paravet/animals/needing-care", {
      title: "Animals Needing Attention",
      needingVaccination,
      needingTagging,
      allAnimals: animalsWithRecommendations,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error getting animals needing vaccination:", error);
    req.flash("error", "Error loading data");
    res.redirect("/paravet/dashboard");
  }
};

// ================ GET FARMER LOCATION MAP ================

exports.getFarmerLocation = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }
    
    const location = farmer.location?.coordinates;
    const hasValidLocation = location && location[0] !== 0 && location[1] !== 0;
    
    res.json({
      success: true,
      farmer: {
        name: farmer.name,
        address: farmer.address,
        location: hasValidLocation ? {
          lat: location[1],
                    lng: location[0]
        } : null,
        mapUrl: hasValidLocation ? `https://www.openstreetmap.org/?mlat=${location[1]}&mlon=${location[0]}#map=15/${location[1]}/${location[0]}` : null
      }
    });
    
  } catch (error) {
    console.error("Error getting farmer location:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ UPDATE VACCINATION RECORD ================

exports.updateVaccinationRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateAdministered, nextDueDate, batchNumber, notes } = req.body;
    const userId = req.user._id;
    
    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }
    
    if (dateAdministered) vaccination.dateAdministered = new Date(dateAdministered);
    if (nextDueDate) vaccination.nextDueDate = new Date(nextDueDate);
    if (batchNumber) vaccination.batchNumber = batchNumber;
    if (notes) vaccination.notes = notes;
    vaccination.updatedBy = userId;
    
    await vaccination.save();
    
    // Update animal summary
    await updateAnimalVaccinationSummary(vaccination.animal);
    
    req.flash("success", "Vaccination record updated successfully");
    res.json({ success: true, message: "Vaccination record updated" });
    
  } catch (error) {
    console.error("Error updating vaccination record:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ DASHBOARD API STATS ================

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    const assignedFarmerIds = paravet.assignedFarmers.map(f => f._id);
    
    const [totalFarmers, totalAnimals, todaySchedules, weekSchedules, pendingVaccinations, completedToday, completedThisWeek] = await Promise.all([
      Farmer.countDocuments({ _id: { $in: assignedFarmerIds }, isActive: true }),
      Animal.countDocuments({ farmer: { $in: assignedFarmerIds }, isActive: true }),
      Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        scheduledDate: { $gte: moment().startOf("day").toDate(), $lte: moment().endOf("day").toDate() },
        status: "Scheduled"
      }),
      Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        scheduledDate: { $gte: moment().startOf("week").toDate(), $lte: moment().endOf("week").toDate() },
        status: "Scheduled"
      }),
      Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        status: { $in: ["Scheduled", "Payment Pending"] }
      }),
      Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        dateAdministered: { $gte: moment().startOf("day").toDate(), $lte: moment().endOf("day").toDate() },
        status: "Administered"
      }),
      Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        dateAdministered: { $gte: moment().startOf("week").toDate(), $lte: moment().endOf("week").toDate() },
        status: "Administered"
      })
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
        completedThisWeek
      }
    });
    
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ================ PARAVET DASHBOARD ================

// controllers/paravet.js

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId })
      .populate("user", "name email mobile")
      .populate({
        path: "assignedFarmers",
        populate: {
          path: "assignedParavet",
          populate: { path: "user", select: "name" }
        }
      });

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    const assignedFarmerIds = paravet.assignedFarmers.map(f => f._id);

    // Get all animals from assigned farmers
    const allAnimals = await Animal.find({
      farmer: { $in: assignedFarmerIds },
      isActive: true
    })
      .populate("farmer", "name mobileNumber address location uniqueFarmerId")
      .lean();

    // Get all vaccinations for these animals
    const allVaccinations = await Vaccination.find({
      farmer: { $in: assignedFarmerIds }
    }).lean();

    // ============ FIX: Get schedules for today and upcoming ============
    const schedules = await Vaccination.find({
      farmer: { $in: assignedFarmerIds },
      status: { $in: ["Scheduled", "Payment Pending"] },
      scheduledDate: { $gte: moment().startOf("day").toDate() }
    })
      .populate("farmer", "name address mobileNumber location")
      .populate("animal", "name tagNumber animalType breed")
      .populate("vaccine", "name vaccineType diseaseTarget")
      .sort({ scheduledDate: 1 })
      .lean();

    // Get untagged animals list
    const untaggedAnimalsList = allAnimals.filter(a => !a.tagNumber);

    // Calculate stats
    const stats = {
      totalFarmers: paravet.assignedFarmers.length,
      totalAnimals: allAnimals.length,
      totalVaccinationsGiven: allVaccinations.filter(v => v.status === "Administered" || v.status === "Completed").length,
      pendingVaccinations: await Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        status: { $in: ["Scheduled", "Payment Pending"] }
      }),
      overdueVaccinations: await Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        nextDueDate: { $lt: new Date() },
        status: { $in: ["Scheduled", "Payment Pending"] }
      }),
      todaySchedules: schedules.filter(s => moment(s.scheduledDate).isSame(moment(), "day")).length,
      taggedAnimals: allAnimals.filter(a => a.tagNumber).length,
      untaggedAnimals: allAnimals.filter(a => !a.tagNumber).length,
      healthyAnimals: allAnimals.filter(a => a.healthStatus?.currentStatus === "Healthy").length,
      completedToday: await Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        dateAdministered: { $gte: moment().startOf("day").toDate(), $lte: moment().endOf("day").toDate() },
        status: "Completed"
      }),
      completedThisWeek: await Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        dateAdministered: { $gte: moment().startOf("week").toDate(), $lte: moment().endOf("week").toDate() },
        status: "Completed"
      }),
      lastWeekCompleted: await Vaccination.countDocuments({
        farmer: { $in: assignedFarmerIds },
        dateAdministered: { $gte: moment().subtract(1, "week").startOf("week").toDate(), $lte: moment().subtract(1, "week").endOf("week").toDate() },
        status: "Completed"
      }),
      farmersServed: new Set(allVaccinations.filter(v => v.status === "Completed").map(v => v.farmer?.toString())).size,
      animalsServed: new Set(allVaccinations.filter(v => v.status === "Completed").map(v => v.animal?.toString())).size
    };

    // Get animals needing vaccination (no vaccinations at all)
    const animalsNeedingVaccination = [];
    for (const animal of allAnimals) {
      const animalVaccinations = await Vaccination.find({ 
        animal: animal._id,
        status: { $in: ["Administered", "Completed"] }
      });
      
      if (animalVaccinations.length === 0) {
        animalsNeedingVaccination.push(animal);
      }
    }

    // Get recent activities
    const recentActivities = await Vaccination.find({
      farmer: { $in: assignedFarmerIds },
      dateAdministered: { $exists: true }
    })
      .populate("farmer", "name")
      .populate("animal", "name tagNumber")
      .populate("vaccine", "name")
      .sort({ dateAdministered: -1 })
      .limit(10)
      .lean();

    res.render("paravet/dashboard/index", {
      title: "Paravet Dashboard",
      paravet,
      stats,
      schedules,  // ← ADD THIS
      untaggedAnimalsList,  // ← ADD THIS
      animalsNeedingVaccination,
      recentActivities,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading paravet dashboard:", error);
    req.flash("error", "Error loading dashboard: " + error.message);
    res.redirect("/login");
  }
};

// ================ GET FARMERS LIST ================

exports.getFarmers = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId })
      .populate({
        path: "assignedFarmers",
        populate: {
          path: "assignedParavet",
          populate: { path: "user", select: "name" }
        }
      });

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    const farmersWithStats = await Promise.all(paravet.assignedFarmers.map(async (farmer) => {
      const animals = await Animal.find({ farmer: farmer._id, isActive: true });
      const pendingVaccinations = await Vaccination.countDocuments({
        farmer: farmer._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      });
      const completedVaccinations = await Vaccination.countDocuments({
        farmer: farmer._id,
        status: { $in: ["Administered", "Completed"] }
      });
      
      // Get location for map
      const location = farmer.location?.coordinates;
      const hasLocation = location && location[0] !== 0 && location[1] !== 0;
      
      return {
        ...farmer.toObject(),
        animalCount: animals.length,
        pendingVaccinations,
        completedVaccinations,
        hasLocation,
        location: hasLocation ? { lat: location[1], lng: location[0] } : null
      };
    }));

    res.render("paravet/farmers/list", {
      title: "My Farmers",
      farmers: farmersWithStats,
      paravet,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error getting farmers:", error);
    req.flash("error", "Error loading farmers");
    res.redirect("/paravet/dashboard");
  }
};

// ================ GET FARMER DETAILS WITH ANIMALS ================

exports.getFarmerDetails = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true
    })
      .populate("registeredBy", "name")
      .populate("assignedParavet", "qualification")
      .populate({
        path: "assignedParavet",
        populate: { path: "user", select: "name" }
      });

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    // Get all animals for this farmer
    const animals = await Animal.find({ farmer: farmerId, isActive: true })
      .populate("registeredBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Get vaccination details for each animal
    const animalsWithDetails = await Promise.all(animals.map(async (animal) => {
      const vaccinations = await Vaccination.find({ animal: animal._id })
        .populate("vaccine", "name")
        .sort({ dateAdministered: -1 })
        .lean();
      
      const lastVaccination = vaccinations[0];
      const nextVaccination = await Vaccination.findOne({
        animal: animal._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      }).sort({ scheduledDate: 1 }).lean();
      
      return {
        ...animal,
        vaccinationsGiven: vaccinations.length,
        lastVaccination: lastVaccination?.dateAdministered || null,
        lastVaccineName: lastVaccination?.vaccine?.name || lastVaccination?.vaccineName,
        nextVaccinationDate: nextVaccination?.scheduledDate || null,
        needsTagging: !animal.tagNumber
      };
    }));

    // Get location for map
    const location = farmer.location?.coordinates;
    const hasLocation = location && location[0] !== 0 && location[1] !== 0;
    const mapUrl = hasLocation ? `https://www.openstreetmap.org/?mlat=${location[1]}&mlon=${location[0]}#map=15/${location[1]}/${location[0]}` : null;

    res.render("paravet/farmers/details", {
      title: `${farmer.name} - Details`,
      farmer,
      animals: animalsWithDetails,
      paravet,
      hasLocation,
      location: hasLocation ? { lat: location[1], lng: location[0] } : null,
      mapUrl,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error getting farmer details:", error);
    req.flash("error", "Error loading farmer details");
    res.redirect("/paravet/farmers");
  }
};

// ================ FARMER VACCINATION FORM (Similar to Admin) ================

exports.getFarmerVaccinationForm = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    // Verify farmer is assigned
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true
    });

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    // Get all animals for this farmer
    const animals = await Animal.find({ farmer: farmerId, isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get all active vaccines
    const vaccines = await Vaccine.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get existing vaccinations for each animal to show which vaccines are already given
    const animalsWithVaccinations = await Promise.all(animals.map(async (animal) => {
      const existingVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Administered", "Completed"] }
      }).distinct("vaccineName");
      
      const pendingSchedules = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      }).populate("vaccine", "name");
      
      return {
        ...animal,
        existingVaccines: existingVaccinations,
        pendingSchedules
      };
    }));

    res.render("paravet/vaccinations/farmer-vaccinate", {
      title: `Vaccinate - ${farmer.name}`,
      farmer,
      animals: animalsWithVaccinations,
      vaccines,
      paravet,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading farmer vaccination form:", error);
    req.flash("error", "Error loading form");
    res.redirect(`/paravet/farmers/${req.params.farmerId}`);
  }
};

// ================ SUBMIT FARMER VACCINATIONS ================

exports.submitFarmerVaccinations = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { vaccinations, commonDate, commonBatchNumber, commonNotes } = req.body;
    const userId = req.user._id;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    // Verify farmer is assigned
    const farmer = await Farmer.findOne({
      _id: farmerId,
      assignedParavet: paravet._id,
      isActive: true
    });

    if (!farmer) {
      req.flash("error", "Farmer not found or not assigned to you");
      return res.redirect("/paravet/farmers");
    }

    const results = {
      success: [],
      failed: [],
      updated: []
    };

    // Process each vaccination entry
    for (const [animalId, vaccineData] of Object.entries(vaccinations || {})) {
      const animal = await Animal.findById(animalId);
      if (!animal) continue;
      
      for (const [vaccineId, data] of Object.entries(vaccineData)) {
        if (!data.administered || data.administered !== "on") continue;
        
        try {
          const vaccine = await Vaccine.findById(vaccineId);
          if (!vaccine) continue;
          
          const adminDate = (commonDate && commonDate !== "") ? new Date(commonDate) : (data.dateAdministered ? new Date(data.dateAdministered) : new Date());
          const batchNumber = (commonBatchNumber && commonBatchNumber !== "") ? commonBatchNumber : (data.batchNumber || "");
          const notes = (commonNotes && commonNotes !== "") ? commonNotes : (data.notes || "");
          
          // Calculate next due date based on vaccine booster or immunity
          let nextDueDate = new Date(adminDate);
          if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
            nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
          } else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
          } else if (vaccine.defaultNextDueMonths && vaccine.defaultNextDueMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.defaultNextDueMonths);
          } else {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          }
          
          // Check if vaccination record already exists
          let vaccination = await Vaccination.findOne({
            animal: animalId,
            vaccine: vaccineId,
            status: { $in: ["Scheduled", "Payment Pending", "Administered"] }
          });
          
          if (vaccination) {
            // Update existing record
            vaccination.status = "Administered";
            vaccination.dateAdministered = adminDate;
            vaccination.nextDueDate = nextDueDate;
            vaccination.administeredBy = req.user.name;
            vaccination.batchNumber = batchNumber;
            vaccination.notes = notes;
            vaccination.verifiedBy = userId;
            vaccination.verifiedAt = new Date();
            await vaccination.save();
            results.updated.push({ animal: animal.name, vaccine: vaccine.name });
          } else {
            // Create new record
            vaccination = new Vaccination({
              farmer: farmerId,
              animal: animalId,
              vaccine: vaccineId,
              vaccineName: vaccine.name,
              vaccineType: vaccine.vaccineType,
              doseNumber: 1,
              totalDosesRequired: 1,
              dateAdministered: adminDate,
              nextDueDate: nextDueDate,
              administeredBy: req.user.name,
              batchNumber: batchNumber,
              notes: notes,
              status: "Administered",
              verifiedBy: userId,
              verifiedAt: new Date(),
              createdBy: userId,
              source: "manual_entry"
            });
            await vaccination.save();
            results.success.push({ animal: animal.name, vaccine: vaccine.name });
          }
          
          // Update animal's vaccination summary
          await updateAnimalVaccinationSummary(animalId);
          
        } catch (error) {
          console.error(`Error processing vaccination:`, error);
          results.failed.push({ animalId, vaccineId, error: error.message });
        }
      }
    }
    
    // Create success message
    let message = "";
    if (results.success.length > 0) {
      message += `${results.success.length} new vaccinations recorded. `;
    }
    if (results.updated.length > 0) {
      message += `${results.updated.length} vaccinations updated. `;
    }
    if (results.failed.length > 0) {
      message += `${results.failed.length} failed.`;
    }
    
    req.flash("success", message || "Vaccination completed successfully!");
    res.redirect(`/paravet/farmers/${farmerId}`);
    
  } catch (error) {
    console.error("Error submitting vaccinations:", error);
    req.flash("error", "Error processing vaccinations: " + error.message);
    res.redirect(`/paravet/farmers/${req.params.farmerId}/vaccinate`);
  }
};

// ================ UPDATE ANIMAL VACCINATION SUMMARY ================

async function updateAnimalVaccinationSummary(animalId) {
  try {
    const animal = await Animal.findById(animalId);
    if (!animal) return;
    
    const allVaccinations = await Vaccination.find({
      animal: animalId,
      status: { $in: ["Administered", "Completed"] }
    }).sort({ dateAdministered: -1 });
    
    // Find next due date from pending vaccinations
    const pendingVaccinations = await Vaccination.find({
      animal: animalId,
      status: { $in: ["Scheduled", "Payment Pending"] },
      nextDueDate: { $exists: true, $ne: null }
    }).sort({ nextDueDate: 1 });
    
    const nextDueDate = pendingVaccinations[0]?.nextDueDate || null;
    const lastVaccination = allVaccinations[0];
    
    animal.vaccinationSummary = {
      lastVaccinationDate: lastVaccination?.dateAdministered || null,
      nextVaccinationDate: nextDueDate,
      lastVaccineType: lastVaccination?.vaccineName || null,
      totalVaccinations: allVaccinations.length,
      isUpToDate: !nextDueDate || nextDueDate <= new Date(),
      lastUpdated: new Date()
    };
    
    await animal.save();
    
  } catch (error) {
    console.error("Error updating animal vaccination summary:", error);
  }
}

// ================ MARK ANIMAL AS TAGGED ================

exports.markAnimalTagged = async (req, res) => {
  try {
    const { animalId } = req.params;
    const { tagNumber } = req.body;
    
    const animal = await Animal.findById(animalId);
    if (!animal) {
      return res.status(404).json({ success: false, message: "Animal not found" });
    }
    
    animal.tagNumber = tagNumber.toUpperCase();
    await animal.save();
    
    res.json({ success: true, message: "Animal tagged successfully" });
    
  } catch (error) {
    console.error("Error marking animal tagged:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ GET UPCOMING SCHEDULES ================

exports.getUpcomingSchedules = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = "week" } = req.query;
    
    const paravet = await Paravet.findOne({ user: userId });
    const assignedFarmerIds = paravet.assignedFarmers.map(f => f._id);
    
    let dateFilter = {};
    const today = moment().startOf("day");
    
    if (period === "today") {
      dateFilter = {
        $gte: today.toDate(),
        $lte: moment().endOf("day").toDate()
      };
    } else if (period === "week") {
      dateFilter = {
        $gte: today.toDate(),
        $lte: moment().endOf("week").toDate()
      };
    } else if (period === "month") {
      dateFilter = {
        $gte: today.toDate(),
        $lte: moment().endOf("month").toDate()
      };
    }
    
    const schedules = await Vaccination.find({
      farmer: { $in: assignedFarmerIds },
      status: { $in: ["Scheduled", "Payment Pending"] },
      scheduledDate: dateFilter
    })
      .populate("farmer", "name address mobileNumber location")
      .populate("animal", "name tagNumber animalType breed")
      .populate("vaccine", "name vaccineType")
      .sort({ scheduledDate: 1 })
      .lean();
    
    res.render("paravet/schedules/index", {
      title: "Upcoming Schedules",
      schedules,
      period,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error getting schedules:", error);
    req.flash("error", "Error loading schedules");
    res.redirect("/paravet/dashboard");
  }
};

// ================ GET VACCINATION HISTORY ================

exports.getVaccinationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { animalId } = req.params;
    
    const paravet = await Paravet.findOne({ user: userId });
    
    const animal = await Animal.findOne({
      _id: animalId,
      farmer: { $in: paravet.assignedFarmers }
    }).populate("farmer", "name");

    if (!animal) {
      req.flash("error", "Animal not found");
      return res.redirect("/paravet/dashboard");
    }
    
    const vaccinations = await Vaccination.find({ animal: animalId })
      .populate("vaccine", "name vaccineType diseaseTarget")
      .sort({ dateAdministered: -1 })
      .lean();
    
    res.render("paravet/vaccinations/history", {
      title: `Vaccination History - ${animal.name || animal.tagNumber}`,
      animal,
      vaccinations,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error getting vaccination history:", error);
    req.flash("error", "Error loading history");
    res.redirect("/paravet/dashboard");
  }
};

// ================ GET TASKS ================

// controllers/paravet.js

exports.getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });
    const { filter = 'all', area } = req.query;

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");
    const weekLater = moment().add(7, "days");

    let query = { assignedParavet: paravet._id };

    // Area filter
    if (area && area !== 'all') {
      const farmersInArea = await Farmer.find({
        isActive: true,
        "address.village": area
      }).select("_id");
      query.farmer = { $in: farmersInArea.map(f => f._id) };
    }

    // Apply filter
    if (filter === 'today') {
      query.scheduledDate = { $gte: today.toDate(), $lte: tomorrow.toDate() };
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    } else if (filter === 'overdue') {
      query.$or = [
        { scheduledDate: { $lt: new Date() }, status: { $in: ["Scheduled", "Payment Pending"] } },
        { nextDueDate: { $lt: new Date() }, status: { $in: ["Scheduled", "Payment Pending"] } }
      ];
    } else if (filter === 'completed') {
      query.status = "Completed";
    } else if (filter === 'upcoming') {
      query.scheduledDate = { $gte: tomorrow.toDate(), $lte: weekLater.toDate() };
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    } else {
      // 'all' - show all pending tasks
      query.status = { $in: ["Scheduled", "Payment Pending"] };
    }

    const tasks = await Vaccination.find(query)
      .populate("farmer", "name address mobileNumber location")
      .populate("animal", "name tagNumber animalType breed")
      .populate("vaccine", "name diseaseTarget")
      .sort({ scheduledDate: 1, nextDueDate: 1 })
      .lean();

    // Calculate task counts for stats
    const totalTasks = await Vaccination.countDocuments({ 
      assignedParavet: paravet._id, 
      status: { $in: ["Scheduled", "Payment Pending"] } 
    });
    
    const todayTasks = await Vaccination.countDocuments({
      assignedParavet: paravet._id,
      scheduledDate: { $gte: today.toDate(), $lte: tomorrow.toDate() },
      status: { $in: ["Scheduled", "Payment Pending"] }
    });
    
    const upcomingTasks = await Vaccination.countDocuments({
      assignedParavet: paravet._id,
      scheduledDate: { $gt: tomorrow.toDate(), $lte: weekLater.toDate() },
      status: { $in: ["Scheduled", "Payment Pending"] }
    });
    
    const overdueTasks = await Vaccination.countDocuments({
      assignedParavet: paravet._id,
      $or: [
        { scheduledDate: { $lt: new Date() }, status: { $in: ["Scheduled", "Payment Pending"] } },
        { nextDueDate: { $lt: new Date() }, status: { $in: ["Scheduled", "Payment Pending"] } }
      ]
    });

    // Group tasks by date
    const groupedTasks = {};
    tasks.forEach(task => {
      const taskDate = moment(task.scheduledDate || task.nextDueDate);
      let dateKey;
      
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

    // Get available areas for filter (from paravet's assigned areas)
    const availableAreas = paravet.assignedAreas || [];

    // Get pending counts by area
    const pendingByArea = await Vaccination.aggregate([
      { $match: { assignedParavet: paravet._id, status: { $in: ["Scheduled", "Payment Pending"] } } },
      { $lookup: { from: "farmers", localField: "farmer", foreignField: "_id", as: "farmerData" } },
      { $unwind: "$farmerData" },
      { $group: { _id: "$farmerData.address.village", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.render("paravet/tasks/index", {
      title: "My Tasks",
      groupedTasks,
      totalTasks,
      todayTasks,
      upcomingTasks,  // ← ADD THIS
      overdueTasks,
      currentFilter: filter,
      selectedArea: area || 'all',
      availableAreas,
      pendingByArea,
      moment,
      user: req.user,
      paravet
    });
    
  } catch (error) {
    console.error("Error fetching tasks:", error);
    req.flash("error", "Error fetching tasks: " + error.message);
    res.redirect("/paravet/dashboard");
  }
};

// ================ COMPLETE TASK ================

exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionDate, batchNumber, notes } = req.body;

    const vaccination = await Vaccination.findById(id).populate("vaccine");

    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const completeDate = completionDate ? new Date(completionDate) : new Date();
    completeDate.setHours(0, 0, 0, 0);

    // Calculate next due date
    let nextDueDate = new Date(completeDate);
    if (vaccination.vaccine) {
      if (vaccination.vaccine.boosterIntervalWeeks && vaccination.vaccine.boosterIntervalWeeks > 0) {
        nextDueDate.setDate(nextDueDate.getDate() + (vaccination.vaccine.boosterIntervalWeeks * 7));
      } else if (vaccination.vaccine.immunityDurationMonths && vaccination.vaccine.immunityDurationMonths > 0) {
        nextDueDate.setMonth(nextDueDate.getMonth() + vaccination.vaccine.immunityDurationMonths);
      } else {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      }
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }

    vaccination.status = "Completed";
    vaccination.dateAdministered = completeDate;
    vaccination.nextDueDate = nextDueDate;
    vaccination.administeredBy = req.user.name;
    if (batchNumber) vaccination.batchNumber = batchNumber;
    if (notes) vaccination.notes = notes;
    vaccination.verifiedBy = req.user._id;
    vaccination.verifiedAt = new Date();

    await vaccination.save();

    // Update animal's vaccination summary
    await updateAnimalVaccinationSummary(vaccination.animal);

    res.json({ 
      success: true, 
      message: `Vaccination completed! Next due: ${nextDueDate.toLocaleDateString()}`,
      nextDueDate: nextDueDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ RESCHEDULE TASK ================

exports.rescheduleTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, reason } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: "Please provide a date" });
    }

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    vaccination.scheduledDate = new Date(scheduledDate);
    vaccination.rescheduleReason = reason || "Rescheduled by paravet";
    vaccination.rescheduledAt = new Date();
    vaccination.rescheduledBy = req.user._id;
    vaccination.status = "Scheduled";

    await vaccination.save();

    res.json({ 
      success: true, 
      message: `Task rescheduled to ${new Date(scheduledDate).toLocaleDateString()}`
    });
  } catch (error) {
    console.error("Error rescheduling task:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ GET REPORTS ================

exports.getReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = "daily", date } = req.query;
    
    const paravet = await Paravet.findOne({ user: userId });
    const assignedFarmerIds = paravet.assignedFarmers.map(f => f._id);
    
    let startDate, endDate;
    const reportDate = date ? moment(date) : moment();
    
    if (type === "daily") {
      startDate = reportDate.clone().startOf("day");
      endDate = reportDate.clone().endOf("day");
    } else if (type === "weekly") {
      startDate = reportDate.clone().startOf("week");
      endDate = reportDate.clone().endOf("week");
    } else if (type === "monthly") {
      startDate = reportDate.clone().startOf("month");
      endDate = reportDate.clone().endOf("month");
    }
    
    const vaccinations = await Vaccination.find({
      farmer: { $in: assignedFarmerIds },
      dateAdministered: { $gte: startDate.toDate(), $lte: endDate.toDate() },
      status: "Completed"
    })
      .populate("farmer", "name")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name")
      .sort({ dateAdministered: 1 })
      .lean();
    
    const summary = {
      total: vaccinations.length,
      byFarmer: {},
      byVaccine: {},
      byAnimalType: {}
    };
    
    vaccinations.forEach(v => {
      const farmerName = v.farmer?.name || "Unknown";
      const vaccineName = v.vaccine?.name || v.vaccineName;
      const animalType = v.animal?.animalType || "Unknown";
      
      summary.byFarmer[farmerName] = (summary.byFarmer[farmerName] || 0) + 1;
      summary.byVaccine[vaccineName] = (summary.byVaccine[vaccineName] || 0) + 1;
      summary.byAnimalType[animalType] = (summary.byAnimalType[animalType] || 0) + 1;
    });
    
    res.render("paravet/reports/index", {
      title: "My Reports",
      type,
      reportDate: reportDate.format("DD MMM YYYY"),
      vaccinations,
      summary,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error generating reports:", error);
    req.flash("error", "Error generating reports");
    res.redirect("/paravet/dashboard");
  }
};
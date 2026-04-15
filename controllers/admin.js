const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const Vaccination = require("../models/vaccination")
const crypto = require("crypto");
const brevo = require("@getbrevo/brevo");

// Configure Brevo API
const brevoApi = new brevo.TransactionalEmailsApi();
brevoApi.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

// Generate password setup token (reuse reset password token fields)
function generatePasswordSetupToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
}

// Send welcome email to sales member
async function sendSalesMemberWelcomeEmail(user, tempPassword, employeeCode, isNewUser) {
  const domain = process.env.DOMAIN || "https://zoopito.in";
  const loginUrl = `${domain}/login`;
  
  // Generate token for password setup (reusing reset password)
  const setupToken = generatePasswordSetupToken(user);
  await user.save();
  
  const setupUrl = `${domain}/reset-password?token=${setupToken}&email=${user.email}`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Zoopito Sales Team</title>
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
        <div class="logo">Zoopito Sales Team</div>
        <div style="font-size: 14px; opacity: 0.9;">Welcome Aboard! 🚀</div>
      </div>
      
      <div class="content">
        <div class="greeting">
          Welcome ${user.name || user.username}!
        </div>
        
        <p>We're excited to have you join the <strong>Zoopito Sales Team</strong>. Your account has been successfully created.</p>
        
        <div class="employee-card">
          <div class="info-row">
            <span class="info-label">📧 Employee Email:</span>
            <span class="info-value">${user.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">🆔 Employee Code:</span>
            <span class="info-value">${employeeCode}</span>
          </div>
          <div class="info-row">
            <span class="info-label">👤 Role:</span>
            <span class="info-value">Sales Team Member</span>
          </div>
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
          <p style="margin-top: 8px;">You have been added to the sales team. You can continue using your existing password to login.</p>
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
            ${isNewUser ? '<li>Click on "Set Your Password" or use the reset password link to create your permanent password</li>' : ''}
            <li>Complete your profile information</li>
            <li>Familiarize yourself with the sales dashboard</li>
            <li>Check your assigned areas and targets</li>
          </ol>
        </div>
        
        <p style="margin-top: 25px; color: #4b5563;">
          Need help? Contact your team lead or reach out to support:
          <br>
          📧 <a href="mailto:sales-support@zoopito.in" style="color: #2563eb;">sales-support@zoopito.in</a>
        </p>
      </div>
      
      <div class="footer">
        <p>
          <strong>Zoopito Sales Team</strong><br>
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
  WELCOME TO ZOOPITO SALES TEAM
  ================================
  
  Welcome ${user.name || user.username}!
  
  Your account has been successfully created.
  
  Employee Details:
  ---------------
  Email: ${user.email}
  Employee Code: ${employeeCode}
  Role: Sales Team Member
  
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
  4. Check your assigned areas and targets
  
  Security Notice:
  - Never share your password with anyone
  - Zoopito staff will never ask for your password
  - If you didn't request this, contact support immediately
  
  Need help? Contact: sales-support@zoopito.in
  
  ---
  Zoopito Sales Team
  © ${new Date().getFullYear()} Zoopito. All rights reserved.
  `;

  try {
    await brevoApi.sendTransacEmail({
      sender: { email: "sales@zoopito.in", name: "Zoopito Sales Team" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: isNewUser 
        ? "🎉 Welcome to Zoopito Sales Team! Login Credentials Inside" 
        : "📋 Added to Zoopito Sales Team",
      htmlContent: htmlContent,
      textContent: textContent,
    });

    console.log(`✅ Welcome email sent to sales member: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send email to ${user.email}:`, emailErr);
    // Don't throw error - we still want to create the sales member even if email fails
  }
}



module.exports.index = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get filter parameters from query
    const { dateRange = 'today', region, animalType, status } = req.query;
    
    // Date range calculation
    let startDate, endDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(dateRange) {
      case 'today':
        startDate = today;
        endDate = new Date(today);
        endDate.setHours(23, 59, 59);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59);
        break;
      case 'last7days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59);
        break;
      case 'last30days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59);
        break;
      case 'thismonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59);
        break;
      case 'lastmonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59);
        break;
      default:
        startDate = today;
        endDate = new Date(today);
        endDate.setHours(23, 59, 59);
    }
    
    // Build filter queries
    let farmerQuery = { isActive: true };
    let animalQuery = { isActive: true };
    let vaccinationQuery = {};
    
    if (region && region !== '') {
      farmerQuery['address.district'] = region;
      animalQuery['address.district'] = region;
    }
    
    if (animalType && animalType !== '') {
      let animalTypeMap = {
        'cow': 'Cow',
        'buffalo': 'Buffalo',
        'goat': 'Goat',
        'sheep': 'Sheep',
        'poultry': 'Poultry',
        'pet': { $in: ['Dog', 'Cat'] }
      };
      animalQuery.animalType = animalTypeMap[animalType] || animalType;
    }
    
    if (status && status !== '') {
      if (status === 'active') vaccinationQuery.status = { $in: ['Scheduled', 'Payment Pending'] };
      else if (status === 'completed') vaccinationQuery.status = 'Completed';
      else if (status === 'pending') vaccinationQuery.status = 'Payment Pending';
    }
    
    // Add date filter to vaccination query
    if (dateRange !== 'all') {
      vaccinationQuery.createdAt = { $gte: startDate, $lte: endDate };
    }
    
    // Get all counts with filters
    const farmersCount = await Farmer.countDocuments(farmerQuery);
    const animalsCount = await Animal.countDocuments(animalQuery);
    const paravetsCount = await Paravet.countDocuments({ isActive: true });
    const salesTeamsCount = await SalesTeam.countDocuments({ isActive: true });
    
    // Get vaccinated animals count
    const vaccinatedAnimals = await Vaccination.distinct('animal', { status: 'Completed' });
    const vaccinatedCount = vaccinatedAnimals.length;
    
    // Get pending vaccinations
    const pendingVaccinations = await Vaccination.countDocuments({
      status: { $in: ['Scheduled', 'Payment Pending'] },
      scheduledDate: { $lte: new Date() }
    });
    
    // Get completed services this month
    const completedServices = await Vaccination.countDocuments({
      status: 'Completed',
      dateAdministered: { $gte: startDate, $lte: endDate }
    });
    
    // Get species breakdown
    const speciesBreakdown = await Animal.aggregate([
      { $match: animalQuery },
      { $group: { _id: '$animalType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get weekly registration trends
    const weeklyTrends = await getWeeklyTrends(startDate, endDate);
    
    // Get recent activities
    const recentActivities = await getRecentActivities(startDate, endDate);
    
    // Get regional distribution
    const regionalDistribution = await Farmer.aggregate([
      { $match: farmerQuery },
      { $group: { _id: '$address.district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get vaccination coverage by species
    const vaccinationCoverage = await getVaccinationCoverage();
    
    // Get paravet performance
    const paravetPerformance = await Paravet.aggregate([
      { $match: { isActive: true } },
      { $lookup: { from: 'vaccinations', localField: '_id', foreignField: 'assignedParavet', as: 'tasks' } },
      { $project: {
          name: { $arrayElemAt: ['$user.name', 0] },
          totalTasks: { $size: '$tasks' },
          completedTasks: { $size: { $filter: { input: '$tasks', as: 't', cond: { $eq: ['$$t.status', 'Completed'] } } } }
        }
      }
    ]);
    
    // Get daily registration data for chart (last 7 days)
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setHours(23, 59, 59);
      
      const count = await Farmer.countDocuments({
        createdAt: { $gte: date, $lte: nextDate }
      });
      
      dailyData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        count: count
      });
    }
    
    // Calculate growth percentages
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (endDate - startDate) / (1000 * 60 * 60 * 24));
    const previousPeriodEnd = new Date(startDate);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
    
    const previousFarmersCount = await Farmer.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd }
    });
    
    const farmerGrowth = previousFarmersCount > 0 
      ? (((farmersCount - previousFarmersCount) / previousFarmersCount) * 100).toFixed(1)
      : 0;
    
    res.render("admin/index.ejs", {
      User: user,
      currUser: req.user,
      farmersCount,
      animalsCount,
      paravetsCount,
      salesTeamsCount,
      vaccinatedCount,
      pendingVaccinations,
      completedServices,
      speciesBreakdown,
      weeklyTrends,
      recentActivities,
      regionalDistribution,
      vaccinationCoverage,
      paravetPerformance,
      dailyData,
      farmerGrowth,
      startDate,
      endDate,
      selectedFilters: { dateRange, region, animalType, status },
      moment: null 
    });
    
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong");
    res.redirect("/login");
  }
};

// Helper function to get weekly trends
async function getWeeklyTrends(startDate, endDate) {
  const trends = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const farmers = await Farmer.countDocuments({
      createdAt: { $gte: weekStart, $lte: weekEnd }
    });
    
    const animals = await Animal.countDocuments({
      createdAt: { $gte: weekStart, $lte: weekEnd }
    });
    
    trends.push({
      week: `Week ${Math.ceil(currentDate.getDate() / 7)}`,
      farmers,
      animals
    });
    
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return trends;
}

// Helper function to get recent activities
async function getRecentActivities(startDate, endDate) {
  const activities = [];
  
  // Get recent farmer registrations
  const recentFarmers = await Farmer.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate('registeredBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  
  recentFarmers.forEach(farmer => {
    activities.push({
      user: farmer.registeredBy?.name || 'System',
      action: `registered new farmer: ${farmer.name}`,
      time: moment(farmer.createdAt).fromNow(),
      type: 'farmer'
    });
  });
  
  // Get recent animal registrations
  const recentAnimals = await Animal.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate('registeredBy', 'name')
    .populate('farmer', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  
  recentAnimals.forEach(animal => {
    activities.push({
      user: animal.registeredBy?.name || 'System',
      action: `added ${animal.animalType} - ${animal.name || 'Unnamed'} for ${animal.farmer?.name}`,
      time: moment(animal.createdAt).fromNow(),
      type: 'animal'
    });
  });
  
  // Get recent vaccinations
  const recentVaccinations = await Vaccination.find({
    dateAdministered: { $gte: startDate, $lte: endDate },
    status: 'Completed'
  })
    .populate('administeredBy', 'name')
    .populate('animal', 'name')
    .sort({ dateAdministered: -1 })
    .limit(5)
    .lean();
  
  recentVaccinations.forEach(vac => {
    activities.push({
      user: vac.administeredBy || 'System',
      action: `completed vaccination for ${vac.animal?.name || 'animal'}`,
      time: moment(vac.dateAdministered).fromNow(),
      type: 'vaccination'
    });
  });
  
  // Sort by time (most recent first) and limit to 10
  return activities.sort((a, b) => {
    const timeA = parseInt(a.time);
    const timeB = parseInt(b.time);
    return timeB - timeA;
  }).slice(0, 10);
}

// Helper function to get vaccination coverage
async function getVaccinationCoverage() {
  const coverage = [];
  
  const species = ['Cow', 'Buffalo', 'Goat', 'Sheep', 'Poultry'];
  
  for (const speciesName of species) {
    const totalAnimals = await Animal.countDocuments({ animalType: speciesName, isActive: true });
    const vaccinatedAnimals = await Vaccination.distinct('animal', {
      status: 'Completed'
    });
    const vaccinatedCount = await Animal.countDocuments({
      animalType: speciesName,
      _id: { $in: vaccinatedAnimals }
    });
    
    coverage.push({
      species: speciesName,
      total: totalAnimals,
      vaccinated: vaccinatedCount,
      percentage: totalAnimals > 0 ? ((vaccinatedCount / totalAnimals) * 100).toFixed(1) : 0
    });
  }
  
  return coverage;
}

//employe id generator for sales memebers
const generateEmployeeCode = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let exists = true;

  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    exists = await SalesTeam.exists({ employeeCode: code });
  }

  return code;
};
// password generator for sales memebers
const generateStrongPassword = () => {
  return crypto.randomBytes(9).toString("base64").slice(0, 12);
};

module.exports.salesindex = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const { search, status, sort } = req.query;

    // 🔹 Base query
    let query = {};

    // 🔍 STATUS FILTER
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // 🔍 SEARCH FILTER (via populated user fields)
    let userMatch = {};
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");

      userMatch = {
        $or: [{ name: regex }, { email: regex }, { mobile: regex }],
      };
    }

    // 🔃 SORTING
    let sortOption = { createdAt: -1 }; // default: most recent

    if (sort === "name") {
      sortOption = { "user.name": 1 };
    } else if (sort === "recent") {
      sortOption = { createdAt: -1 };
    }

    // 📦 DATA QUERY
    const salesQuery = SalesTeam.find(query)
      .populate({
        path: "user",
        select: "name email mobile",
        match: userMatch,
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const countQuery = SalesTeam.countDocuments(query);

    let [salesTeam, totalCount] = await Promise.all([salesQuery, countQuery]);

    // ⚠️ Remove records where populate didn't match search
    if (search) {
      salesTeam = salesTeam.filter((member) => member.user);
      totalCount = salesTeam.length;
    }

    const totalPages = Math.ceil(totalCount / limit);

    res.render("admin/salesteam/index", {
      currentUser: req.user,
      salesTeam,
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      filters: {
        search: search || "",
        status: status || "",
        sort: sort || "",
      },
    });
  } catch (error) {
    console.error("SalesTeam Index Error:", error);
    req.flash("error", "Unable to load sales team data");
    res.redirect("/admin");
  }
};

module.exports.addnewSalesMemberForm = async (req, res) => {
  try {
    res.render("admin/salesteam/new.ejs");
  } catch (error) {
    console.error("SalesTeam New Form Error:", error);
    req.flash("error", "Unable to load sales team form");
    res.redirect("/admin/sales-team");
  }
};

// Create Sales Member (Updated)
module.exports.createSalesMember = async (req, res) => {
  try {
    const { name, email, mobile, assignedAreas, remarks } = req.body;

    if (!name || !email) {
      req.flash("error", "Name and Email are required");
      return res.redirect("back");
    }

    // Normalize assigned area
    const areas = assignedAreas?.village ? [assignedAreas] : [];
    
    // Find or create user
    let user = await User.findOne({ email });
    let tempPassword = null;
    let isNewUser = false;

    if (!user) {
      tempPassword = generateStrongPassword();
      isNewUser = true;

      user = new User({
        name,
        email,
        mobile,
        role: "SALES",
        isActive: true,
        isVerified: true, // Auto-verify sales team members
      });

      await User.register(user, tempPassword);

      console.log(`✅ Temporary password for ${email}: ${tempPassword}`);
    } else {
      let changed = false;

      if (user.role !== "SALES") {
        user.role = "SALES";
        changed = true;
      }

      if (!user.isActive) {
        user.isActive = true;
        changed = true;
      }

      if (changed) {
        await user.save();
      }
    }

    // Prevent duplicate sales member
    const exists = await SalesTeam.findOne({ user: user._id });
    if (exists) {
      req.flash("error", "User already exists in sales team");
      return res.redirect("/admin/sales-team");
    }

    // Generate employee code
    const employeeCode = await generateEmployeeCode();

    // Save sales member
    const salesMember = new SalesTeam({
      user: user._id,
      employeeCode,
      assignedAreas: areas,
      remarks,
      lastActiveAt: new Date(),
    });

    await salesMember.save();

    // Send welcome email
    await sendSalesMemberWelcomeEmail(user, tempPassword, employeeCode, isNewUser);

    req.flash(
      "success", 
      `Sales member created successfully. ${isNewUser ? 'Welcome email with temporary password sent.' : 'User added to sales team.'}`
    );
    res.redirect("/admin/sales-team");
  } catch (err) {
    console.error("❌ Error creating sales member:", err);
    req.flash("error", "Something went wrong: " + err.message);
    res.redirect("/admin/sales-team");
  }
};

// Check if password needs to be set (middleware)
module.exports.checkPasswordSetup = async (req, res, next) => {
  if (req.user && req.user.resetPasswordToken && req.user.resetPasswordExpires > Date.now()) {
    // User has an active password reset token - means they haven't set their password yet
    req.flash("warning", "Please set your permanent password to continue.");
    return res.redirect(`/reset-password?token=${req.user.resetPasswordToken}&email=${req.user.email}&firstLogin=true`);
  }
  next();
};

// Update password reset function to handle first-time setup
module.exports.renderResetPasswordForm = async (req, res) => {
  const { token, email, firstLogin } = req.query;
  
  if (!token || !email) {
    req.flash("error", "Invalid password reset link");
    return res.redirect("/login");
  }
  
  const user = await User.findOne({ 
    email, 
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }
  });
  
  if (!user) {
    req.flash("error", "Password reset link has expired or is invalid");
    return res.redirect("/login");
  }
  
  res.render("users/reset-password.ejs", { 
    token, 
    email, 
    firstLogin: firstLogin === 'true' 
  });
};

module.exports.resetPassword = async (req, res) => {
  try {
    const { token, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match");
      return res.redirect(`/reset-password?token=${token}&email=${email}`);
    }
    
    if (password.length < 8) {
      req.flash("error", "Password must be at least 8 characters long");
      return res.redirect(`/reset-password?token=${token}&email=${email}`);
    }
    
    const user = await User.findOne({ 
      email, 
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      req.flash("error", "Password reset link has expired or is invalid");
      return res.redirect("/login");
    }
    
    // Set the new password
    await user.setPassword(password);
    
    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    req.flash("success", "Password has been set successfully! Please login with your new password.");
    res.redirect("/login");
  } catch (err) {
    console.error("Password reset error:", err);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/login");
  }
};

// Forgot password functionality (if needed separately)
module.exports.renderForgotPasswordForm = (req, res) => {
  res.render("users/forgot-password.ejs");
};

module.exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      req.flash("error", "No account found with that email address");
      return res.redirect("/forgot-password");
    }
    
    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send reset email
    await sendPasswordResetEmail(user, token);
    
    req.flash("success", "Password reset instructions have been sent to your email");
    res.redirect("/login");
  } catch (err) {
    console.error("Forgot password error:", err);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/forgot-password");
  }
};

// Send password reset email (reuse same template structure)
async function sendPasswordResetEmail(user, token) {
  const domain = process.env.DOMAIN || "https://zoopito.in";
  const resetUrl = `${domain}/reset-password?token=${token}&email=${user.email}`;
  
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Reset Your Password - Zoopito</title>
    <style>
      /* Similar styling as above */
      body {
        font-family: 'Inter', Arial, sans-serif;
        line-height: 1.6;
        color: #374151;
        background-color: #f9fafb;
      }
      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 20px;
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #0f8150 0%, #0ea5e9 100%);
        padding: 40px 20px;
        text-align: center;
        color: white;
      }
      .content {
        padding: 40px;
      }
      .cta-button {
        display: inline-block;
        background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
        color: white;
        padding: 14px 30px;
        text-decoration: none;
        border-radius: 10px;
        font-weight: 600;
        margin: 20px 0;
      }
      .footer {
        background-color: #f9fafb;
        padding: 30px 40px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <div class="logo">Zoopito</div>
        <div>Password Reset Request</div>
      </div>
      
      <div class="content">
        <h2>Hello ${user.name || user.username}!</h2>
        
        <p>We received a request to reset the password for your Zoopito account.</p>
        
        <p>Click the button below to create a new password:</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="cta-button">
            Reset Your Password
          </a>
        </div>
        
        <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        
        <hr>
        
        <p style="font-size: 14px; color: #6b7280;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          ${resetUrl}
        </p>
      </div>
      
      <div class="footer">
        <p>Zoopito Security Team</p>
        <p>© ${new Date().getFullYear()} Zoopito. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
  
  try {
    await brevoApi.sendTransacEmail({
      sender: { email: "support@zoopito.in", name: "Zoopito Support" },
      to: [{ email: user.email, name: user.name || user.username }],
      subject: "Reset Your Zoopito Password",
      htmlContent: htmlContent,
    });
    
    console.log(`✅ Password reset email sent to: ${user.email}`);
  } catch (emailErr) {
    console.error(`❌ Failed to send reset email to ${user.email}:`, emailErr);
    throw new Error("Failed to send password reset email");
  }
}

module.exports.viewSalesMember = async (req, res) => {
  try {
    const { id } = req.params;

    const salesMember = await SalesTeam.findById(id)
      .populate("user")
      .populate({
        path: "onboardedFarmers",
      })
      .populate({
        path: "onboardedAnimals",
      });

    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/salesteam");
    }

    const totalOnboardedFarmers = await Farmer.countDocuments({
      registeredBy: salesMember.user._id,
    });

    const totalOnboardedAnimals = await Animal.countDocuments({
      registeredBy: salesMember.user._id,
    });
    console.log(totalOnboardedAnimals, "and", totalOnboardedFarmers);

    res.render("admin/salesteam/details.ejs", {
      User: req.user,
      salesMember,
      totalOnboardedFarmers,
      totalOnboardedAnimals,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Unable to load sales member details");
    res.redirect("/admin/sales-team");
  }
};

module.exports.editSalesMemberForm = async (req, res) => {
  try {
    const { id } = req.params;
    const salesMember = await SalesTeam.findById(id).populate("user");
    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/sales-team");
    }

    res.render("admin/salesteam/edit.ejs", {
      salesMember,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Unable to load edit form");
    res.redirect("/admin/sales-team");
  }
};

module.exports.updateSalesMember = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, email, mobile, assignedAreas, isActive } = req.body;

    // 1. Find sales member
    const salesMember = await SalesTeam.findById(id).populate("user");
    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/sales-team");
    }

    // 2. Update linked user details
    if (salesMember.user) {
      salesMember.user.name = name;
      salesMember.user.email = email;
      salesMember.user.mobile = mobile;
      await salesMember.user.save();
    }

    // 3. Normalize assignedAreas (form sends OBJECT, schema needs ARRAY)
    if (assignedAreas) {
      salesMember.assignedAreas = [
        {
          village: assignedAreas.village || "",
          taluka: assignedAreas.taluka || "",
          district: assignedAreas.district || "",
          state: assignedAreas.state || "",
        },
      ];
    }

    // 4. Update active status
    salesMember.isActive = isActive === "true";

    // 5. Save sales member
    await salesMember.save();

    req.flash("success", "Sales member updated successfully");
    res.redirect("/admin/sales-team");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error in updating sales member details");
    res.redirect("/admin/sales-team");
  }
};

// ACTIVATE sales member
module.exports.activateSalesMember = async (req, res) => {
  try {
    const { id } = req.params;

    const salesMember = await SalesTeam.findById(id);
    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/sales-team");
    }

    salesMember.isActive = true;
    await salesMember.save();

    req.flash("success", "Sales member activated successfully");
    res.redirect("/admin/sales-team");
  } catch (error) {
    console.error(error);
    req.flash("error", "Unable to activate sales member");
    res.redirect("/admin/sales-team");
  }
};

// DEACTIVATE sales member
module.exports.deactivateSalesMember = async (req, res) => {
  try {
    const { id } = req.params;

    const salesMember = await SalesTeam.findById(id);
    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/sales-team");
    }

    salesMember.isActive = false;
    await salesMember.save();

    req.flash("success", "Sales member deactivated successfully");
    res.redirect("/admin/sales-team");
  } catch (error) {
    console.error(error);
    req.flash("error", "Unable to deactivate sales member");
    res.redirect("/admin/sales-team");
  }
};
module.exports.deleteSalesMember = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find sales member with linked user
    const salesMember = await SalesTeam.findById(id).populate("user");
    if (!salesMember) {
      req.flash("error", "Sales member not found");
      return res.redirect("/admin/sales-team");
    }

    // 2. Delete linked user (if exists)
    if (salesMember.user) {
      await User.findByIdAndDelete(salesMember.user._id);
    }

    // 3. Delete sales member
    await SalesTeam.findByIdAndDelete(id);

    req.flash("success", "Sales member deleted permanently");
    res.redirect("/admin/sales-team");
  } catch (error) {
    console.error(error);
    req.flash("error", "Failed to delete sales member");
    res.redirect("/admin/sales-team");
  }
};

module.exports.paravetsIndexpage = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    // 🔐 Security: only active admins should reach here
    // (Assuming middleware already checks role)

    const [paravets, totalCount] = await Promise.all([
      Paravet.find()
        .populate("user", "name email mobile") // minimal safe fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Paravet.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render("admin/parvets.ejs", {
      currentUser: req.user,
      paravets,
      currentPage: page,
      totalPages,
      totalCount,
      limit,
    });
  } catch (error) {
    console.error("Error fetching paravets:", error);
    req.flash("error", "Unable to fetch paravets at this time.");
    res.status(500).send("Internal Server Error");
  }
};

module.exports.adminSettingPage = async (req, res) => {
  try {
    const admins = await User.find({ role: "ADMIN" })
      .select("name email mobile lastLogin createdAt isActive")
      .sort({ createdAt: -1 })
      .lean();

    res.render("admin/settings", {
      admins,
    });
  } catch (error) {
    console.error("Error in Admin Settings:", error);
    req.flash("error", "Unable to load admin settings.");
    res.redirect("/admin");
  }
};

module.exports.renderAddAdmin = (req, res) => {
  res.render("admin/addAdmin.ejs");
};

module.exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "Email already registered");
      return res.redirect("/admin/settings/add-admin");
    }

    const newAdmin = new User({
      name,
      email,
      role: "ADMIN",
    });

    // passport-local-mongoose magic
    await User.register(newAdmin, password);

    req.flash("success", "New admin created successfully");
    res.redirect("/admin/settings");
  } catch (err) {
    console.error("Add Admin Error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/settings/add-admin");
  }
};

module.exports.allUsers = async (req, res) => {
  try {
    const {
      search,
      role,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by role
    if (role && role !== "all") {
      query.role = role.toUpperCase();
    }

    // Filter by status
    if (status === "active") {
      query.isActive = true;
      query.isBlocked = false;
    } else if (status === "inactive") {
      query.isActive = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    }

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    // Get users with pagination
    const users = await User.find(query)
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Get user statistics
    const stats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ isActive: true, isBlocked: false }),
      inactive: await User.countDocuments({ isActive: false }),
      blocked: await User.countDocuments({ isBlocked: true }),
      verified: await User.countDocuments({ isVerified: true }),
      byRole: {
        admin: await User.countDocuments({ role: "ADMIN" }),
        sales: await User.countDocuments({ role: "SALES" }),
        paravet: await User.countDocuments({ role: "PARAVET" }),
        farmer: await User.countDocuments({ role: "FARMER" }),
        user: await User.countDocuments({ role: "USER" }),
      },
    };

    res.render("admin/others/allusers.ejs", {
      users,
      stats,
      filters: req.query,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        totalUsers,
      },
      roles: ["ADMIN", "SALES", "PARAVET", "FARMER", "USER"],
      statuses: ["active", "inactive", "blocked"],
      title: "User Management",
    });
  } catch (err) {
    console.error("All users error:", err);
    req.flash("error", "❌ Failed to load users page");
    res.redirect("/admin/dashboard");
  }
};

// Export Users to CSV
module.exports.exportUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    if (role && role !== "all") {
      query.role = role.toUpperCase();
    }

    if (status === "active") {
      query.isActive = true;
      query.isBlocked = false;
    } else if (status === "inactive") {
      query.isActive = false;
    } else if (status === "blocked") {
      query.isBlocked = true;
    }

    const users = await User.find(query)
      .select(
        "name email mobile role designation isActive isBlocked isVerified createdAt lastLogin",
      )
      .sort({ createdAt: -1 })
      .lean();

    // Convert to CSV
    const fields = [
      "Name",
      "Email",
      "Mobile",
      "Role",
      "Designation",
      "Status",
      "Verified",
      "Created At",
      "Last Login",
    ];
    const csvData = users.map((user) => ({
      Name: user.name,
      Email: user.email,
      Mobile: user.mobile || "",
      Role: user.role,
      Designation: user.designation || "",
      Status: user.isBlocked
        ? "Blocked"
        : user.isActive
          ? "Active"
          : "Inactive",
      Verified: user.isVerified ? "Yes" : "No",
      "Created At": new Date(user.createdAt).toLocaleDateString(),
      "Last Login": user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString()
        : "Never",
    }));

    // Generate CSV
    const csv = [
      fields.join(","),
      ...csvData.map((row) =>
        fields.map((field) => `"${row[field] || ""}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=users_${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (err) {
    console.error("Export users error:", err);
    req.flash("error", "❌ Failed to export users");
    res.redirect("/admin/users");
  }
};

// User status toggle controllers
module.exports.activateUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { isActive: true });
    req.flash("success", "✅ User activated successfully");
    res.redirect("/admin/allusers");
  } catch (err) {
    console.error("Activate user error:", err);
    req.flash("error", "❌ Failed to activate user");
    res.redirect("/admin/allusers");
  }
};

module.exports.deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { isActive: false });
    req.flash("warning", "⚠️ User deactivated");
    res.redirect("/admin/allusers");
  } catch (err) {
    console.error("Deactivate user error:", err);
    req.flash("error", "❌ Failed to deactivate user");
    res.redirect("/admin/allusers");
  }
};

module.exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { isBlocked: true });
    req.flash("warning", "⛔ User blocked");
    res.redirect("/admin/allusers");
  } catch (err) {
    console.error("Block user error:", err);
    req.flash("error", "❌ Failed to block user");
    res.redirect("/admin/allusers");
  }
};

module.exports.unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndUpdate(id, { isBlocked: false });
    req.flash("success", "✅ User unblocked");
    res.redirect("/admin/allusers");
  } catch (err) {
    console.error("Unblock user error:", err);
    req.flash("error", "❌ Failed to unblock user");
    res.redirect("/admin/allusers");
  }
};

// View user details
module.exports.viewUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!user) {
      req.flash("error", "❌ User not found");
      return res.redirect("/admin/allusers");
    }

    res.render("admin/users/view", {
      user,
      title: `User Details - ${user.name}`,
    });
  } catch (err) {
    console.error("View user error:", err);
    req.flash("error", "❌ Failed to load user details");
    res.redirect("/admin/allusers");
  }
};

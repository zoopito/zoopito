const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const crypto = require("crypto");

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

    // 🔐 Security: only active admins should reach here
    // (Assuming middleware already checks role)

    const [salesTeam, totalCount] = await Promise.all([
      SalesTeam.find()
        .populate("user", "name email mobile") // minimal safe fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      SalesTeam.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render("admin/salesteam/index", {
      currentUser: req.user,
      salesTeam,
      currentPage: page,
      totalPages,
      totalCount,
      limit,
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

module.exports.createSalesMember = async (req, res) => {
  try {
    const { name, email, mobile, assignedAreas, remarks } = req.body;

    if (!name || !email) {
      req.flash("error", "Name and Email are required");
      return res.redirect("back");
    }
    // 🔹 Normalize assigned area
    const areas = assignedAreas?.village ? [assignedAreas] : [];
    // 🔹 Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = generateStrongPassword();

      user = new User({
        name,
        email,
        mobile,
        role: "SALES",
        isActive: true,
      });

      await User.register(user, randomPassword);

      console.log(`Login password for ${email}: ${randomPassword}`);
    }

    // 🔹 Prevent duplicate sales member
    const exists = await SalesTeam.findOne({ user: user._id });
    if (exists) {
      req.flash("error", "User already exists in sales team");
      return res.redirect("/admin/sales-team");
    }

    // 🔹 Generate employee code
    const employeeCode = await generateEmployeeCode();

    // 🔹 Save sales member
    const salesMember = new SalesTeam({
      user: user._id,
      employeeCode,
      assignedAreas: areas,
      remarks,
      lastActiveAt: new Date(),
    });

    await salesMember.save();

    req.flash("success", "Sales member created successfully");
    res.redirect("/admin/sales-team");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/admin/sales-team");
  }
};

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

    res.render("admin/salesteam/details.ejs", {
      User: req.user,
      salesMember,
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Unable to load sales member details");
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

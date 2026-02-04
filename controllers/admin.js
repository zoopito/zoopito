const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const crypto = require("crypto");

module.exports.index = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const notifications = user.notifications || [];
    const notificationCount = notifications.length;
    const tile = "Admin Dashboard";
    const shortDescription =
      "This is admin panel admin can control everything from here sales team, farmers, animals, vaccinations etc.";
    const farmersCount = await Farmer.countDocuments();
    const animalsCount = await Animal.countDocuments();
    const paravetsCount = await Paravet.countDocuments();
    // const servicesCount = await Servise.countDocuments();
    const salesTeamsCount = await SalesTeam.countDocuments();
    res.render("admin/index.ejs", {
      User: user,
      tile,
      shortDescription,
      farmersCount,
      animalsCount,
      paravetsCount,
      salesTeamsCount,
    });
  } catch (err) {
    console.log(err);
    req.flash("error", "Somthing went wrong");
    res.redirect("/login");
  }
};

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

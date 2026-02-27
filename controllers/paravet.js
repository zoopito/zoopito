const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
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

    exists = await Farmer.exists({ employeeCode: code });
  }

  return code;
};
// password generator for sales memebers
const generateStrongPassword = () => {
  return crypto.randomBytes(9).toString("base64").slice(0, 12);
};

module.exports.paravetsindex = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("salesteam");
    const paravets = await Paravet.find({ user: user._id });
    res.render("paravets/index", { user, paravets });
  } catch (error) {
    console.error("Error fetching paravets:", error);
    req.flash("error", "Unable to fetch paravets at this time.");
    res.status(500).send("Internal Server Error");
  }
};

module.exports.createParavetForm = async (req, res) => {
  try {
    res.render("paravet/new.ejs");
  } catch (error) {
    console.error("Error rendering create paravet form:", error);
    req.flash("error", "Unable to load form at this time.");
    res.status(500).send("Internal Server Error");
  }
};

module.exports.createParavet = async (req, res) => {
  try {
    const { user, paravet } = req.body;

    // 1️⃣ Find existing user
    let existingUser = await User.findOne({
      $or: [{ email: user.email }, { mobile: user.mobile }],
    });

    let finalUser;

    if (existingUser) {
      finalUser = existingUser;
      // ✅ Update role if not already PARAVET
      if (finalUser.role !== "PARAVET") {
        finalUser.role = "PARAVET";
        await finalUser.save();
      }
    } else {
      // 2️⃣ Create new user
      const newUser = new User({
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: "PARAVET",
      });

      const password =
        typeof generateStrongPassword === "function"
          ? generateStrongPassword()
          : "Temp@123";

      await User.register(newUser, password);
      finalUser = newUser;
    }

    // 3️⃣ Check if already paravet (FIXED)
    const alreadyParavet = await Paravet.findOne({
      user: finalUser._id,
    });

    if (alreadyParavet) {
      req.flash("error", "This user is already registered as a Paravet");
      return res.redirect("/admin/paravets");
    }

    const isActive = !!paravet.isActive;
    // 4️⃣ Create Paravet safely
    const newParavet = new Paravet({
      user: finalUser._id,
      qualification: paravet.qualification,
      licenseNumber: paravet.licenseNumber || undefined,
      assignedAreas: paravet.assignedAreas || [],
      isActive,
    });

    await newParavet.save();

    req.flash("success", "Paravet added successfully");
    res.redirect("/admin/paravets");
  } catch (error) {
    console.error("Create Paravet Error:", error);

    if (error.code === 11000) {
      req.flash("error", "License number already exists");
      return res.redirect("/admin/paravets/new");
    }

    req.flash("error", "Failed to create Paravet");
    res.redirect("/admin/paravets/new");
  }
};

module.exports.viewParavet = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Validate Mongo ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid Paravet ID");
      return res.redirect("/admin/paravets");
    }

    const paravet = await Paravet.findById(id)
      .populate("user", "name email mobile role isActive")
      .populate("assignedFarmers", "name mobileNumber uniqueFarmerId")
      .lean();

    if (!paravet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    res.render("paravet/view.ejs", {
      paravet,
      currentUser: req.user,
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

    res.render("paravet/edit.ejs", { paravet });
  } catch (error) {
    console.error("Edit Paravet Error:", error);
    req.flash("error", "Unable to load paravet details");
    res.redirect("/admin/paravets");
  }
};

module.exports.updateParavet = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, paravet } = req.body;

    const existingParavet = await Paravet.findById(id);
    if (!existingParavet) {
      req.flash("error", "Paravet not found");
      return res.redirect("/admin/paravets");
    }

    // ✅ Update User
    await User.findByIdAndUpdate(existingParavet.user, {
      name: user.name,
      role: "PARAVET",
      email: user.email,
      mobile: user.mobile,
    });

    // ✅ Normalize checkbox
    paravet.isActive = paravet.isActive === "on";

    // ✅ Update Paravet
    await Paravet.findByIdAndUpdate(id, paravet, {
      runValidators: true,
    });

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
    } else if (action === "deactivate") {
      paravet.isActive = false;
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

    // delete linked user
    await User.findByIdAndDelete(paravet.user);

    // delete paravet
    await Paravet.findByIdAndDelete(id);

    req.flash("success", "Paravet deleted permanently");
    res.redirect("/admin/paravets");
  } catch (error) {
    console.error("Delete Paravet Error:", error);
    req.flash("error", "Unable to delete paravet");
    res.redirect("/admin/paravets");
  }
};

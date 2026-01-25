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

module.exports.farmersIndex = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    // 🔐 Admin-only access assumed via middleware

    const query = {}; // Future: add filters here

    const [farmers, totalCount] = await Promise.all([
      Farmer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),

      Farmer.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    if (page > totalPages && totalPages > 0) {
      return res.redirect(`/admin/farmers?page=${totalPages}`);
    }

    res.render("admin/farmer/index", {
      currentUser: req.user,
      farmers,
      currentPage: page,
      totalPages,
      totalCount,
      limit,
    });
  } catch (error) {
    console.error("Farmer Index Error:", error);
    req.flash("error", "Unable to load farmer data");
    res.redirect("/admin");
  }
};

module.exports.createFarmerForm = async (req, res) => {
  try {
    res.render("admin/farmer/new.ejs");
  } catch (error) {
    console.error("Farmer New Form Error:", error);
    req.flash("error", "Unable to load farmer form");
    res.redirect("/admin/farmers");
  }
};

module.exports.createFarmer = async (req, res) => {
  let user;

  try {
    const farmerData = req.body.farmer;

    // 1️⃣ Check mobile already exists
    const existingUser = await User.findOne({
      mobile: farmerData.mobileNumber,
    });

    if (existingUser) {
      req.flash("error", "Mobile number already registered");
      return res.redirect("/admin/farmers/new");
    }

    // 2️⃣ Create farmer user account
    const randomPassword = generateStrongPassword();

    user = new User({
      name: farmerData.name,
      email: farmerData.email || `${farmerData.mobileNumber}@zoopito.com`,
      mobile: farmerData.mobileNumber,
      role: "FARMER", // must exist in enum
      isActive: true,
    });

    await User.register(user, randomPassword); // passport-local-mongoose
    console.log(`Farmer login password for ${user.mobile}: ${randomPassword}`);
    // 3️⃣ Generate farmer ID
    const uniqueFarmerId = await generateEmployeeCode();

    // 4️⃣ Create farmer
    const farmer = new Farmer({
      name: farmerData.name,
      mobileNumber: farmerData.mobileNumber,
      address: farmerData.address,
      location: farmerData.location,
      registeredBy: req.user._id,
      uniqueFarmerId,
      user: user._id,
    });

    // 5️⃣ GPS safety
    if (
      !farmer.location?.coordinates ||
      farmer.location.coordinates.length !== 2
    ) {
      farmer.location = {
        type: "Point",
        coordinates: [0, 0],
      };
    }

    // 6️⃣ Image upload
    if (req.file) {
      farmer.photo = {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename,
      };
    }

    await farmer.save();

    req.flash(
      "success",
      `Farmer added successfully. Temporary password: ${randomPassword}`,
    );

    res.redirect("/admin/farmers");
  } catch (error) {
    console.error("Create Farmer Error:", error);

    // 🔄 Rollback user
    if (user) {
      await User.findByIdAndDelete(user._id);
    }

    req.flash("error", "Failed to create farmer");
    res.redirect("/admin/farmers/new");
  }
};

module.exports.viewFarmer = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔐 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid farmer ID");
      return res.redirect("/admin/farmers");
    }

    const farmer = await Farmer.findOne({
      _id: id,
      isActive: true, // soft delete safety
    })
      .populate("registeredBy", "name email mobile role")
      .populate({
        path: "assignedParavet",
        populate: {
          path: "user",
          select: "name mobile",
        },
      })
      .lean();
    if (!farmer) {
      req.flash("error", "Farmer not found or inactive");
      return res.redirect("/admin/farmers");
    }

    res.render("admin/farmer/view.ejs", {
      farmer,
      currentUser: req.user,
    });
  } catch (error) {
    console.error("View Farmer Error:", error);
    req.flash("error", "Unable to load farmer details");
    res.redirect("/admin/farmers");
  }
};

module.exports.renderEditform = async (req, res) => {
  try {
    const { id } = req.params;
    const farmer = await Farmer.findById(id).populate("registeredBy");
    res.render("admin/farmer/edit.ejs", { farmer });
  } catch (error) {
    console.error("Error in redring edit form:", error);
    req.flash("error", "Unable to load Farmer edit page");
    res.redirect("/admin/farmers");
  }
};

module.exports.updateFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerData = req.body.farmer;

    // Checkbox fix (unchecked checkbox doesn't come in req.body)
    farmerData.isActive = farmerData.isActive ? true : false;

    // Fix GeoJSON location (ensure numbers)
    if (
      farmerData.location &&
      farmerData.location.coordinates &&
      farmerData.location.coordinates.length === 2
    ) {
      farmerData.location = {
        type: "Point",
        coordinates: [
          Number(farmerData.location.coordinates[0]),
          Number(farmerData.location.coordinates[1]),
        ],
      };
    }

    // Update basic farmer data
    let farmer = await Farmer.findByIdAndUpdate(id, farmerData, {
      new: true,
      runValidators: true,
    });

    if (!farmer) {
      req.flash("error", "Farmer not found");
      return res.redirect("/admin/farmers");
    }

    // Handle photo update (if new photo uploaded)
    if (req.file) {
      // OPTIONAL: delete old image from cloudinary
      /*
      if (farmer.photo?.public_id) {
        await cloudinary.uploader.destroy(farmer.photo.public_id);
      }
      */

      farmer.photo = {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename, // adjust if needed
      };

      await farmer.save();
    }

    // Optional: Remove photo checkbox
    if (req.body.removePhoto) {
      /*
      if (farmer.photo?.public_id) {
        await cloudinary.uploader.destroy(farmer.photo.public_id);
      }
      */
      farmer.photo = undefined;
      await farmer.save();
    }

    req.flash("success", "Farmer updated successfully");
    res.redirect("/admin/farmers");
  } catch (error) {
    console.error("Error updating farmer:", error);

    // Duplicate mobile number error
    if (error.code === 11000) {
      req.flash("error", "Mobile number already exists");
      return res.redirect(`/admin/farmers/${req.params.id}/edit`);
    }

    req.flash("error", "Unable to update farmer");
    res.redirect(`/admin/farmers/${req.params.id}/edit`);
  }
};

module.exports.toggleFarmerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await Farmer.findById(id);
    if (!farmer) {
      return res
        .status(404)
        .json({ success: false, message: "Farmer not found" });
    }

    farmer.isActive = !farmer.isActive;
    await farmer.save();

    res.json({
      success: true,
      isActive: farmer.isActive,
      message: farmer.isActive ? "Farmer activated" : "Farmer deactivated",
    });
  } catch (error) {
    console.error("Toggle farmer status error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to update status" });
  }
};

module.exports.deleteFarmer = async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await Farmer.findById(id);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    // 1️⃣ Delete linked FARMER user (role-based safety)
    await User.findOneAndDelete({
      mobile: farmer.mobileNumber,
      role: "FARMER",
    });

    // 2️⃣ OPTIONAL: delete farmer photo from cloudinary
    /*
    if (farmer.photo?.public_id) {
      await cloudinary.uploader.destroy(farmer.photo.public_id);
    }
    */

    // 3️⃣ Delete farmer document
    await Farmer.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Farmer and linked user deleted successfully",
    });
  } catch (error) {
    console.error("Delete farmer error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete farmer",
    });
  }
};

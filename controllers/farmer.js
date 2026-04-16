const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Service = require("../models/services");
const SalesTeam = require("../models/salesteam");
const Vaccination = require("../models/vaccination");
const Payment = require("../models/payment");
const moment = require("moment");
const mongoose = require("mongoose");
const crypto = require("crypto");

// ================ FARMER DASHBOARD ================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    };
    // Get farmer profile linked to this user
    const farmer = await Farmer.findOne({ mobileNumber: user.mobile })
      .populate("assignedParavet", "qualification licenseNumber rating")
      .populate({
        path: "assignedParavet",
        populate: { path: "user", select: "name email mobile" }
      })
      .lean();

    if (!farmer) {
      req.flash("error", "Farmer profile not found. Please contact support.");
      return res.redirect("/");
    }

    // Get all animals for this farmer
    const animals = await Animal.find({ farmer: farmer._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    // Get animal statistics
    const animalStats = {
      total: animals.length,
      byType: {},
      vaccinated: 0,
      pendingVaccinations: 0,
      pregnant: 0,
      healthy: 0,
      underTreatment: 0
    };

    animals.forEach(animal => {
      // Count by type
      animalStats.byType[animal.animalType] = (animalStats.byType[animal.animalType] || 0) + 1;
      
      // Vaccination status
      if (animal.vaccinationSummary?.isUpToDate) {
        animalStats.vaccinated++;
      }
      
      // Pregnancy status
      if (animal.pregnancyStatus?.isPregnant) {
        animalStats.pregnant++;
      }
      
      // Health status
      if (animal.healthStatus?.currentStatus === "Healthy") {
        animalStats.healthy++;
      } else if (animal.healthStatus?.currentStatus === "Under Treatment") {
        animalStats.underTreatment++;
      }
    });

    // Get recent vaccinations (last 10)
    const recentVaccinations = await Vaccination.find({ farmer: farmer._id })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ dateAdministered: -1 })
      .limit(10)
      .lean();

    // Get upcoming vaccinations (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingVaccinations = await Vaccination.find({
      farmer: farmer._id,
      nextDueDate: { $gte: new Date(), $lte: thirtyDaysFromNow },
      status: { $in: ["Scheduled", "Payment Pending", "Administered"] }
    })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1 })
      .limit(10)
      .lean();

    // Get overdue vaccinations
    const overdueVaccinations = await Vaccination.find({
      farmer: farmer._id,
      nextDueDate: { $lt: new Date() },
      status: { $ne: "Completed" }
    })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1 })
      .lean();

    // Get recent payments
    const recentPayments = await Payment.find({ farmerId: farmer._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      { $match: { farmerId: farmer._id, paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]);

    // Get services summary
    let servicesSummary = null;
    servicesSummary = await Service.aggregate([
      { $match: { farmer: farmer._id } },
      { $group: { _id: "$serviceType", count: { $sum: 1 } } }
    ]);

    // Get health summary (animals needing attention)
    const animalsNeedingAttention = animals.filter(a => 
      a.healthStatus?.currentStatus === "Sick" || 
      a.healthStatus?.currentStatus === "Under Treatment" ||
      (a.vaccinationSummary?.nextVaccinationDate && new Date(a.vaccinationSummary.nextVaccinationDate) < new Date())
    ).length;

    // Prepare chart data for vaccination trends (last 6 months)
    const vaccinationTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = moment().subtract(i, "months").startOf("month");
      const monthEnd = moment().subtract(i, "months").endOf("month");
      
      const count = await Vaccination.countDocuments({
        farmer: farmer._id,
        dateAdministered: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() },
        status: "Completed"
      });
      
      vaccinationTrends.push({
        month: monthStart.format("MMM YYYY"),
        count
      });
    }

    res.render("farmer/dashboard", {
      title: "Farmer Dashboard - Zoopito",
      farmer,
      animals,
      animalStats,
      recentVaccinations,
      upcomingVaccinations,
      overdueVaccinations,
      recentPayments,
      paymentStats: paymentStats[0] || { total: 0, count: 0 },
      servicesSummary,
      animalsNeedingAttention,
      vaccinationTrends,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading farmer dashboard:", error);
    req.flash("error", "Error loading dashboard");
    res.redirect("/");
  }
};

// ================ MY ANIMALS PAGE ================
exports.getMyAnimals = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }
    const farmer = await Farmer.findOne({ mobileNumber: user.mobile}).lean();
    if (!farmer) {
      req.flash("error", "Farmer profile not found");
      return res.redirect("/");
    }

    const animals = await Animal.find({ farmer: farmer._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    // Get vaccination summary for each animal
    const animalsWithDetails = await Promise.all(animals.map(async (animal) => {
      const lastVaccination = await Vaccination.findOne({
        animal: animal._id,
        status: "Completed"
      }).sort({ dateAdministered: -1 }).lean();
      
      const nextVaccination = await Vaccination.findOne({
        animal: animal._id,
        nextDueDate: { $gte: new Date() },
        status: { $in: ["Scheduled", "Administered"] }
      }).sort({ nextDueDate: 1 }).lean();
      
      return {
        ...animal,
        lastVaccination,
        nextVaccination
      };
    }));

    res.render("farmer/animals", {
      title: "My Animals - Zoopito",
      farmer,
      animals: animalsWithDetails,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading animals page:", error);
    req.flash("error", "Error loading animals");
    res.redirect("/farmer/dashboard");
  }
};

// ================ ANIMAL DETAILS PAGE ================
exports.getAnimalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }
    const farmer = await Farmer.findOne({ mobileNumber: user.mobile}).lean();
    if (!farmer) {
      req.flash("error", "Farmer profile not found");
      return res.redirect("/");
    }

    const animal = await Animal.findOne({ _id: id, farmer: farmer._id })
      .lean();

    if (!animal) {
      req.flash("error", "Animal not found");
      return res.redirect("/farmer/animals");
    }

    // Get vaccination history
    const vaccinationHistory = await Vaccination.find({ animal: animal._id })
      .populate("vaccine", "name diseaseTarget")
      .sort({ dateAdministered: -1 })
      .lean();

    // Get upcoming vaccinations
    const upcomingVaccinations = await Vaccination.find({
      animal: animal._id,
      nextDueDate: { $gte: new Date() },
      status: { $in: ["Scheduled", "Administered"] }
    }).sort({ nextDueDate: 1 }).lean();

    // Get service history
    const serviceHistory = await Service.find({ animal: animal._id })
      .populate("paravet", "qualification")
      .populate({
        path: "paravet",
        populate: { path: "user", select: "name" }
      })
      .sort({ serviceDate: -1 })
      .lean();

    res.render("farmer/animal-details", {
      title: `${animal.name || "Animal"} - Details`,
      farmer,
      animal,
      vaccinationHistory,
      upcomingVaccinations,
      serviceHistory,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading animal details:", error);
    req.flash("error", "Error loading animal details");
    res.redirect("/farmer/animals");
  }
};

// ================ VACCINATION HISTORY PAGE ================
exports.getVaccinationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }
    const farmer = await Farmer.findOne({ mobileNumber: user.mobile}).lean();
    if (!farmer) {
      req.flash("error", "Farmer profile not found");
      return res.redirect("/");
    }

    const vaccinations = await Vaccination.find({ farmer: farmer._id })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ dateAdministered: -1 })
      .lean();

    res.render("farmer/vaccinations", {
      title: "Vaccination History - Zoopito",
      farmer,
      vaccinations,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading vaccination history:", error);
    req.flash("error", "Error loading vaccination history");
    res.redirect("/farmer/dashboard");
  }
};

// ================ PAYMENT HISTORY PAGE ================
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }
    const farmer = await Farmer.findOne({ mobileNumber: user.mobile}).lean();
    if (!farmer) {
      req.flash("error", "Farmer profile not found");
      return res.redirect("/");
    }

    const payments = await Payment.find({ farmerId: farmer._id })
      .populate("animalIds", "name tagNumber")
      .sort({ createdAt: -1 })
      .lean();

    res.render("farmer/payments", {
      title: "Payment History - Zoopito",
      farmer,
      payments,
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading payment history:", error);
    req.flash("error", "Error loading payment history");
    res.redirect("/farmer/dashboard");
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

    exists = await Farmer.exists({ employeeCode: code });
  }

  return code;
};
// password generator for sales memebers
const generateStrongPassword = () => {
  return crypto.randomBytes(9).toString("base64").slice(0, 12);
};

module.exports.farmersIndex = async (req, res) => {
  const role = req.user.role.toLowerCase();
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
      return res.redirect(`/${role}/farmers?page=${totalPages}`);
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
    res.redirect(`/${role}`);
  }
};

module.exports.createFarmerForm = async (req, res) => {
  const role = req.user.role.toLowerCase();
  try {
    res.render("admin/farmer/new.ejs");
  } catch (error) {
    console.error("Farmer New Form Error:", error);
    req.flash("error", "Unable to load farmer form");
    res.redirect(`/${role}/farmers`);
  }
};

module.exports.createFarmer = async (req, res) => {
  const role = req.user.role.toLowerCase();
  let user;

  try {
    const farmerData = req.body.farmer;

    // 1️⃣ Check mobile already exists
    const existingUser = await User.findOne({
      mobile: farmerData.mobileNumber,
    });

    if (existingUser) {
      req.flash("error", "Mobile number already registered");
      return res.redirect(`/${role}/farmers/new`);
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

    res.redirect(`/${role}/farmers`);
  } catch (error) {
    console.error("Create Farmer Error:", error);

    // 🔄 Rollback user
    if (user) {
      await User.findByIdAndDelete(user._id);
    }

    req.flash("error", "Failed to create farmer");
    res.redirect(`/${role}/farmers/new`);
  }
};

exports.viewFarmer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            req.flash("error", "Invalid farmer ID");
            return res.redirect("/admin/farmers");
        }

        // Get farmer with populated data
        const farmer = await Farmer.findById(id)
            .populate("assignedParavet", "employeeCode")
            .populate("assignedParavet.user", "name email")
            .lean();

        if (!farmer) {
            req.flash("error", "Farmer not found");
            return res.redirect("/admin/farmers");
        }

        // Get all animals for this farmer
        const animals = await Animal.find({ farmer: id, isActive: true })
            .sort({ createdAt: -1 })
            .lean();

        const activeAnimals = animals.filter(a => a.status === 'active').length;
        const healthyAnimals = animals.filter(a => a.healthStatus?.currentStatus === 'Healthy').length;
        const underTreatment = animals.filter(a => a.healthStatus?.currentStatus === 'Under Treatment').length;

        // Get all vaccinations for this farmer
        const vaccinations = await Vaccination.find({ farmer: id })
            .populate("animal", "name tagNumber animalType")
            .populate("vaccine", "name")
            .sort({ createdAt: -1 })
            .lean();

        const totalVaccinations = vaccinations.length;
        const completedVaccinations = vaccinations.filter(v => v.status === "Completed").length;
        const pendingVaccinations = vaccinations.filter(v => v.status === "Scheduled" || v.status === "Payment Pending").length;
        
        // Get upcoming and overdue vaccinations
        const now = new Date();
        const upcomingVaccinations = vaccinations.filter(v => 
            v.nextDueDate && new Date(v.nextDueDate) > now && v.status !== "Completed"
        ).sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate));
        
        const overdueVaccinations = vaccinations.filter(v => 
            v.nextDueDate && new Date(v.nextDueDate) < now && v.status !== "Completed"
        );

        const vaccinationRate = totalVaccinations > 0 
            ? Math.round((completedVaccinations / totalVaccinations) * 100) 
            : 0;

        // Get payments
        const payments = await Payment.find({ farmerId: id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Get recent activities (combine vaccinations and animal additions)
        const recentVaccinations = vaccinations.slice(0, 5).map(v => ({
            type: 'vaccination',
            description: `${v.vaccineName || v.vaccine?.name} vaccination for ${v.animal?.name || 'animal'}`,
            timestamp: v.dateAdministered || v.createdAt
        }));

        const recentAnimals = animals.slice(0, 5).map(a => ({
            type: 'animal',
            description: `Added new ${a.animalType} - ${a.name || 'Unnamed'}`,
            timestamp: a.createdAt
        }));

        const activities = [...recentVaccinations, ...recentAnimals]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        res.render("admin/farmer/view.ejs", {
            title: `${farmer.name} - Farmer Details`,
            farmer,
            animals,
            activeAnimals,
            healthyAnimals,
            underTreatment,
            vaccinations,
            totalVaccinations,
            completedVaccinations,
            pendingVaccinations,
            upcomingVaccinations,
            overdueVaccinations,
            vaccinationRate,
            payments,
            activities,
            currentUser: req.user,
            moment: moment
        });
    } catch (error) {
        console.error("View Farmer Details Error:", error);
        req.flash("error", "Unable to load farmer details");
        res.redirect("/admin/farmers");
    }
};

module.exports.renderEditform = async (req, res) => {
  const role = req.user.role.toLowerCase();
  try {
    const { id } = req.params;
    const farmer = await Farmer.findById(id).populate("registeredBy");
    res.render("admin/farmer/edit.ejs", { farmer });
  } catch (error) {
    console.error("Error in redring edit form:", error);
    req.flash("error", "Unable to load Farmer edit page");
    res.redirect(`/${role}/farmers`);
  }
};

module.exports.updateFarmer = async (req, res) => {
  const role = req.user.role.toLowerCase();
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
      return res.redirect(`/${role}/farmers`);
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
    res.redirect(`/${role}/farmers`);
  } catch (error) {
    console.error("Error updating farmer:", error);

    // Duplicate mobile number error
    if (error.code === 11000) {
      req.flash("error", "Mobile number already exists");
      return res.redirect(`/${role}/farmers/${req.params.id}/edit`);
    }

    req.flash("error", "Unable to update farmer");
    res.redirect(`/${role}/farmers/${req.params.id}/edit`);
  }
};

module.exports.toggleFarmerStatus = async (req, res) => {
  const role = req.user.role.toLowerCase();
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
  const role = req.user.role.toLowerCase();

  try {
    const { id } = req.params;

    const farmer = await Farmer.findById(id);
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found",
      });
    }

    // ❌ Hard delete hata diya
    // await Farmer.findByIdAndDelete(id);

    // ✅ Soft delete
    farmer.isActive = false;
    await farmer.save();

    // ❗ OPTIONAL: linked user bhi deactivate karo instead of delete
    await User.findOneAndUpdate(
      {
        mobile: farmer.mobileNumber,
        role: "FARMER",
      },
      { isActive: false },
    );

    res.json({
      success: true,
      message: "Farmer deactivated successfully",
    });
  } catch (error) {
    console.error("Delete farmer error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete farmer",
    });
  }
};

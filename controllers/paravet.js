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

//-----------------------------------//
// paavetdash board
//----------------------------------//

// ================ GET DASHBOARD ================
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get paravet details
    const paravet = await Paravet.findOne({ user: userId })
      .populate("user", "name email phone")
      .populate("assignedFarmers", "name mobileNumber address totalAnimals");

    if (!paravet) {
      req.flash("error", "Paravet profile not found");
      return res.redirect("/login");
    }

    // Get today's date range
    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");

    // Get counts and stats
    const [
      totalFarmers,
      totalAnimals,
      todaySchedules,
      pendingVaccinations,
      completedToday,
      upcomingSchedules,
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
        .limit(5)
        .lean(),
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

    // Get performance metrics
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
    ]);

    res.render("paravet/dashboard", {
      title: "Paravet Dashboard",
      farmName: "Zoopito",
      paravet,
      stats: {
        totalFarmers,
        totalAnimals,
        todaySchedules,
        pendingVaccinations,
        completedToday,
        upcomingSchedules: upcomingSchedules.length,
        totalCompleted: await Vaccination.countDocuments({
          assignedParavet: paravet._id,
          status: "Completed",
        }),
        totalEarnings: await Vaccination.aggregate([
          { $match: { assignedParavet: paravet._id, status: "Completed" } },
          { $group: { _id: null, total: { $sum: "$payment.totalAmount" } } },
        ]).then((res) => res[0]?.total || 0),
      },
      upcomingSchedules,
      recentActivities,
      performanceMetrics,
      moment,
      user: req.user,
    });
  } catch (error) {
    console.error("Error loading paravet dashboard:", error);
    req.flash("error", "Error loading dashboard");
    res.redirect("/login");
  }
};

// ================ GET STATS API ================
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

// ================ GET UPCOMING SCHEDULES ================
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

    // Group by date
    const grouped = {};
    schedules.forEach((schedule) => {
      const dateKey = moment(schedule.scheduledDate).format("YYYY-MM-DD");
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: schedule.scheduledDate,
          formattedDate: moment(schedule.scheduledDate).format(
            "dddd, DD MMM YYYY",
          ),
          schedules: [],
        };
      }
      grouped[dateKey].schedules.push(schedule);
    });

    res.json({
      success: true,
      schedules: Object.values(grouped),
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching schedules" });
  }
};

// ================ GET FARMER LIST ================
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

    res.json({
      success: true,
      farmers: farmersWithStats,
    });
  } catch (error) {
    console.error("Error fetching farmers:", error);
    res.status(500).json({ success: false, message: "Error fetching farmers" });
  }
};

// ================ GET FARMER ANIMALS ================
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
    });

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: "Farmer not found or not assigned to you",
      });
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

        return {
          ...animal,
          pendingVaccinations,
          completedCount: completedVaccinations,
          hasPending: pendingVaccinations.length > 0,
        };
      }),
    );

    res.json({
      success: true,
      farmer,
      animals: animalsWithVaccinations,
    });
  } catch (error) {
    console.error("Error fetching farmer animals:", error);
    res.status(500).json({ success: false, message: "Error fetching animals" });
  }
};

// ================ START VISIT ================
exports.startVisit = async (req, res) => {
  try {
    const { farmerId } = req.body;
    const userId = req.user._id;

    const paravet = await Paravet.findOne({ user: userId });

    // Create a visit record (you may want to create a Visit model)
    // For now, we'll just log it
    console.log(
      `Visit started for farmer ${farmerId} by paravet ${paravet._id}`,
    );

    // You can store in session or create a temporary record
    req.session.currentVisit = {
      farmerId,
      startTime: new Date(),
      paravetId: paravet._id,
    };

    res.json({
      success: true,
      message: "Visit started successfully",
      visit: req.session.currentVisit,
    });
  } catch (error) {
    console.error("Error starting visit:", error);
    res.status(500).json({ success: false, message: "Error starting visit" });
  }
};

// ================ COMPLETE VISIT ================
exports.completeVisit = async (req, res) => {
  try {
    const { farmerId, notes, vaccinationsCompleted } = req.body;

    if (
      !req.session.currentVisit ||
      req.session.currentVisit.farmerId !== farmerId
    ) {
      return res.status(400).json({
        success: false,
        message: "No active visit found",
      });
    }

    const visit = req.session.currentVisit;
    const endTime = new Date();
    const duration = (endTime - new Date(visit.startTime)) / (1000 * 60); // in minutes

    // Here you would save the visit to database if you have a Visit model
    console.log(`Visit completed for farmer ${farmerId}`);
    console.log(`Duration: ${duration} minutes`);
    console.log(`Vaccinations completed: ${vaccinationsCompleted}`);
    console.log(`Notes: ${notes}`);

    // Clear the session
    delete req.session.currentVisit;

    // Update paravet stats
    await Paravet.findByIdAndUpdate(visit.paravetId, {
      $inc: { totalServicesCompleted: vaccinationsCompleted || 1 },
    });

    res.json({
      success: true,
      message: "Visit completed successfully",
      duration: Math.round(duration),
    });
  } catch (error) {
    console.error("Error completing visit:", error);
    res.status(500).json({ success: false, message: "Error completing visit" });
  }
};

// ================ PERFORM VACCINATION ================
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
    } = req.body;

    const vaccination = await Vaccination.findById(id)
      .populate("animal")
      .populate("farmer");

    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccination not found" });
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
        "vaccinationSummary.lastVaccineType": vaccination.vaccineName,
        "vaccinationSummary.isUpToDate": true,
        "vaccinationSummary.lastUpdated": new Date(),
      },
      $inc: { "vaccinationSummary.totalVaccinations": 1 },
      $push: {
        "vaccinationSummary.vaccinesGiven": {
          vaccine: vaccination.vaccine,
          vaccineName: vaccination.vaccineName,
          lastDate: new Date(),
          status: "up_to_date",
        },
      },
    });

    res.json({
      success: true,
      message: "Vaccination completed successfully",
      vaccination,
    });
  } catch (error) {
    console.error("Error performing vaccination:", error);
    res
      .status(500)
      .json({ success: false, message: "Error performing vaccination" });
  }
};

// ================ BULK PERFORM VACCINATIONS ================
exports.bulkPerformVaccinations = async (req, res) => {
  try {
    const { vaccinationIds, commonData } = req.body;

    if (
      !vaccinationIds ||
      !Array.isArray(vaccinationIds) ||
      vaccinationIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No vaccinations selected",
      });
    }

    const results = [];
    const errors = [];

    for (const id of vaccinationIds) {
      try {
        const vaccination = await Vaccination.findById(id);

        if (!vaccination) {
          errors.push(`Vaccination ${id} not found`);
          continue;
        }

        vaccination.status = "Completed";
        vaccination.dateAdministered = new Date();
        vaccination.administeredBy = req.user.name;

        if (commonData) {
          if (commonData.batchNumber)
            vaccination.batchNumber = commonData.batchNumber;
          if (commonData.expiryDate)
            vaccination.expiryDate = commonData.expiryDate;
          if (commonData.administrationMethod)
            vaccination.administrationMethod = commonData.administrationMethod;
          if (commonData.notes) vaccination.notes = commonData.notes;
        }

        await vaccination.save();

        await Animal.findByIdAndUpdate(vaccination.animal, {
          $set: {
            "vaccinationSummary.lastVaccinationDate": new Date(),
            "vaccinationSummary.lastVaccineType": vaccination.vaccineName,
            "vaccinationSummary.isUpToDate": true,
            "vaccinationSummary.lastUpdated": new Date(),
          },
          $inc: { "vaccinationSummary.totalVaccinations": 1 },
        });

        results.push(id);
      } catch (error) {
        errors.push(`Error with ${id}: ${error.message}`);
      }
    }

    res.json({
      success: results.length > 0,
      message: `Successfully completed ${results.length} vaccinations${errors.length > 0 ? ` with ${errors.length} errors` : ""}`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulk perform:", error);
    res
      .status(500)
      .json({ success: false, message: "Error performing bulk vaccinations" });
  }
};

// ================ GET PENDING VACCINATIONS ================
exports.getPendingVaccinations = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const { farmerId, status, dueDate } = req.query;

    const query = {
      assignedParavet: paravet._id,
      status: { $in: ["Scheduled", "Payment Pending"] },
    };

    if (farmerId) {
      query.farmer = farmerId;
    }

    if (dueDate === "overdue") {
      query.nextDueDate = { $lt: new Date() };
    } else if (dueDate === "today") {
      const today = moment().startOf("day");
      const tomorrow = moment().endOf("day");
      query.nextDueDate = { $gte: today.toDate(), $lte: tomorrow.toDate() };
    } else if (dueDate === "week") {
      const weekEnd = moment().add(7, "days").endOf("day");
      query.nextDueDate = { $lte: weekEnd.toDate() };
    }

    const vaccinations = await Vaccination.find(query)
      .populate("farmer", "name address mobileNumber")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1, scheduledDate: 1 })
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

    res.json({
      success: true,
      total: vaccinations.length,
      groupedVaccinations: Object.values(groupedByFarmer),
    });
  } catch (error) {
    console.error("Error fetching pending vaccinations:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching pending vaccinations" });
  }
};

// ================ GET DAILY REPORT ================
exports.getDailyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });

    const today = moment().startOf("day");
    const tomorrow = moment().endOf("day");

    const vaccinations = await Vaccination.find({
      assignedParavet: paravet._id,
      dateAdministered: { $gte: today.toDate(), $lte: tomorrow.toDate() },
    })
      .populate("farmer", "name mobileNumber address")
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name")
      .sort({ dateAdministered: 1 })
      .lean();

    const summary = {
      total: vaccinations.length,
      byFarmer: {},
      byVaccine: {},
      totalEarnings: 0,
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

      // Calculate earnings
      summary.totalEarnings += vac.payment?.totalAmount || 0;
    });

    res.render("paravet/daily-report", {
      title: "Daily Report",
      farmName: "Zoopito",
      date: today.format("DD MMMM YYYY"),
      vaccinations,
      summary,
      user: req.user,
    });
  } catch (error) {
    console.error("Error generating daily report:", error);
    req.flash("error", "Error generating report");
    res.redirect("/paravet/dashboard");
  }
};

// ================ GET WEEKLY REPORT ================
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
      .populate("vaccine", "name")
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
      };
    }

    vaccinations.forEach((vac) => {
      const dayKey = moment(vac.dateAdministered).format("YYYY-MM-DD");
      if (daily[dayKey]) {
        daily[dayKey].count++;
        daily[dayKey].earnings += vac.payment?.totalAmount || 0;
      }
    });

    res.render("paravet/weekly-report", {
      title: "Weekly Report",
      farmName: "Zoopito",
      weekStart: weekStart.format("DD MMM"),
      weekEnd: weekEnd.format("DD MMM YYYY"),
      daily: Object.values(daily),
      total: vaccinations.length,
      totalEarnings: vaccinations.reduce(
        (sum, v) => sum + (v.payment?.totalAmount || 0),
        0,
      ),
      user: req.user,
    });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    req.flash("error", "Error generating report");
    res.redirect("/paravet/dashboard");
  }
};

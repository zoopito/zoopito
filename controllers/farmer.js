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
    }

    // Role-based logic
    let farmer = null;
    let farmersList = [];
    let isParavetView = false;
    let isAdminView = false;

    // Check if user is Paravet
    if (req.user.role === "PARAVET") {
      isParavetView = true;
      
      // Get paravet profile with assigned farmers
      const paravet = await Paravet.findOne({ user: userId })
        .populate({
          path: "assignedFarmers",
          populate: {
            path: "assignedParavet",
            populate: { path: "user", select: "name" }
          }
        })
        .lean();

      if (!paravet) {
        req.flash("error", "Paravet profile not found");
        return res.redirect("/");
      }

      // Get all assigned farmers
      farmersList = paravet.assignedFarmers || [];
      
      // If there's a specific farmer selected from filters
      const selectedFarmerId = req.query.farmerId;
      if (selectedFarmerId && selectedFarmerId !== 'all') {
        farmer = farmersList.find(f => f._id.toString() === selectedFarmerId);
      } else if (farmersList.length === 1) {
        // If only one farmer assigned, show that farmer's dashboard
        farmer = farmersList[0];
      }
      // If multiple farmers, show summary view with farmer selector
      
    } else if (req.user.role === "ADMIN" || req.user.role === "SALES") {
      isAdminView = true;
      
      // Get specific farmer if selected from query
      const selectedFarmerId = req.query.farmerId;
      if (selectedFarmerId && selectedFarmerId !== 'all') {
        farmer = await Farmer.findById(selectedFarmerId)
          .populate("assignedParavet", "qualification licenseNumber rating")
          .populate({
            path: "assignedParavet",
            populate: { path: "user", select: "name email mobile" }
          })
          .lean();
      } else {
        // Get all farmers for dropdown
        farmersList = await Farmer.find({ isActive: true })
          .select("name mobileNumber address.village uniqueFarmerId")
          .sort({ name: 1 })
          .lean();
        
        // If no specific farmer selected, show first farmer or summary
        if (farmersList.length > 0 && !farmer) {
          farmer = farmersList[0];
        }
      }
    } else {
      // Original farmer user logic
      farmer = await Farmer.findOne({ mobileNumber: user.mobile })
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
    }

    // Get filter parameters for tasks
    const taskFilter = req.query.taskFilter || 'all';
    const statusFilter = req.query.status || 'all';
    const animalTypeFilter = req.query.animalType || 'all';
    
    // If no farmer selected (paravet with multiple farmers), show summary view
    if (!farmer && farmersList.length > 0 && isParavetView) {
      // Get summary statistics for all assigned farmers
      const allAnimals = await Animal.find({
        farmer: { $in: farmersList.map(f => f._id) },
        isActive: true
      }).lean();
      
      const allVaccinations = await Vaccination.find({
        farmer: { $in: farmersList.map(f => f._id) }
      }).lean();
      
      // Build farmers with stats
      const farmersWithStats = await Promise.all(farmersList.map(async (f) => {
        const farmerAnimals = allAnimals.filter(a => a.farmer.toString() === f._id.toString());
        const farmerVaccinations = allVaccinations.filter(v => v.farmer.toString() === f._id.toString());
        
        return {
          ...f,
          animalCount: farmerAnimals.length,
          pendingVaccinations: farmerVaccinations.filter(v => 
            v.status === "Scheduled" || v.status === "Payment Pending"
          ).length,
          completedVaccinations: farmerVaccinations.filter(v => 
            v.status === "Completed"
          ).length,
          overdueVaccinations: farmerVaccinations.filter(v => 
            v.nextDueDate && new Date(v.nextDueDate) < new Date() && v.status !== "Completed"
          ).length
        };
      }));
      
      return res.render("paravet/farmers-summary", {
        title: "Assigned Farmers - Zoopito",
        farmers: farmersWithStats,
        totalFarmers: farmersList.length,
        totalAnimals: allAnimals.length,
        totalPendingTasks: allVaccinations.filter(v => 
          v.status === "Scheduled" || v.status === "Payment Pending"
        ).length,
        paravet: await Paravet.findOne({ user: userId }).lean(),
        user: req.user,
        moment
      });
    }
    
    // If no farmer found
    if (!farmer) {
      req.flash("error", "No farmer data available");
      return res.redirect("/");
    }

    // Build query for animals with filters
    let animalQuery = { farmer: farmer._id, isActive: true };
    
    // Animal type filter
    if (animalTypeFilter !== 'all') {
      animalQuery.animalType = animalTypeFilter;
    }
    
    // Health status filter
    if (statusFilter === 'healthy') {
      animalQuery['healthStatus.currentStatus'] = 'Healthy';
    } else if (statusFilter === 'sick') {
      animalQuery['healthStatus.currentStatus'] = { $in: ['Sick', 'Under Treatment'] };
    } else if (statusFilter === 'pregnant') {
      animalQuery['pregnancyStatus.isPregnant'] = true;
    } else if (statusFilter === 'vaccinated') {
      animalQuery['vaccinationSummary.isUpToDate'] = true;
    } else if (statusFilter === 'unvaccinated') {
      animalQuery['vaccinationSummary.isUpToDate'] = false;
    }

    // Get all animals for this farmer with filters
    const animals = await Animal.find(animalQuery)
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
      underTreatment: 0,
      byHealthStatus: {
        healthy: 0,
        sick: 0,
        underTreatment: 0,
        recovered: 0,
        critical: 0
      }
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
      
      // Health status with detailed breakdown
      const healthStatus = animal.healthStatus?.currentStatus || "Unknown";
      if (healthStatus === "Healthy") {
        animalStats.healthy++;
        animalStats.byHealthStatus.healthy++;
      } else if (healthStatus === "Sick") {
        animalStats.byHealthStatus.sick++;
      } else if (healthStatus === "Under Treatment") {
        animalStats.underTreatment++;
        animalStats.byHealthStatus.underTreatment++;
      } else if (healthStatus === "Recovered") {
        animalStats.byHealthStatus.recovered++;
      } else if (healthStatus === "Critical") {
        animalStats.byHealthStatus.critical++;
      }
    });

    // Build vaccination query based on task filter
    let vaccinationQuery = { farmer: farmer._id };
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (taskFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59);
      vaccinationQuery.scheduledDate = { $gte: todayStart, $lte: todayEnd };
    } else if (taskFilter === 'week') {
      vaccinationQuery.nextDueDate = { $gte: now, $lte: sevenDaysFromNow };
    } else if (taskFilter === 'month') {
      vaccinationQuery.nextDueDate = { $gte: now, $lte: thirtyDaysFromNow };
    } else if (taskFilter === 'overdue') {
      vaccinationQuery.nextDueDate = { $lt: now };
      vaccinationQuery.status = { $ne: "Completed" };
    } else if (taskFilter === 'pending') {
      vaccinationQuery.status = { $in: ["Scheduled", "Payment Pending"] };
    } else if (taskFilter === 'completed') {
      vaccinationQuery.status = "Completed";
    }

    // Get recent vaccinations with filters
    let recentVaccinationsQuery = Vaccination.find({ farmer: farmer._id })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ dateAdministered: -1 })
      .limit(10);
    
    if (taskFilter === 'completed') {
      recentVaccinationsQuery = Vaccination.find(vaccinationQuery)
        .populate("animal", "name tagNumber animalType")
        .populate("vaccine", "name diseaseTarget")
        .sort({ dateAdministered: -1 })
        .limit(10);
    }
    
    const recentVaccinations = await recentVaccinationsQuery.lean();

    // Get upcoming vaccinations with filters
    let upcomingQuery = {
      farmer: farmer._id,
      nextDueDate: { $gte: now, $lte: thirtyDaysFromNow },
      status: { $in: ["Scheduled", "Payment Pending", "Administered"] }
    };
    
    if (taskFilter === 'week') {
      upcomingQuery.nextDueDate = { $gte: now, $lte: sevenDaysFromNow };
    } else if (taskFilter === 'month') {
      upcomingQuery.nextDueDate = { $gte: now, $lte: thirtyDaysFromNow };
    } else if (taskFilter === 'overdue') {
      upcomingQuery = {
        farmer: farmer._id,
        nextDueDate: { $lt: now },
        status: { $ne: "Completed" }
      };
    }
    
    const upcomingVaccinations = await Vaccination.find(upcomingQuery)
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1 })
      .limit(10)
      .lean();

    // Get overdue vaccinations
    const overdueVaccinations = await Vaccination.find({
      farmer: farmer._id,
      nextDueDate: { $lt: now },
      status: { $ne: "Completed" }
    })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1 })
      .lean();

    // Get pending count for summary cards
    const pendingCount = await Vaccination.countDocuments({
      farmer: farmer._id,
      status: { $in: ["Scheduled", "Payment Pending"] }
    });
    
    const overdueCount = await Vaccination.countDocuments({
      farmer: farmer._id,
      nextDueDate: { $lt: now },
      status: { $ne: "Completed" }
    });

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
    let servicesSummary = await Service.aggregate([
      { $match: { farmer: farmer._id } },
      { $group: { _id: "$serviceType", count: { $sum: 1 } } }
    ]);

    // Get health summary (animals needing attention)
    const animalsNeedingAttention = animals.filter(a => 
      a.healthStatus?.currentStatus === "Sick" || 
      a.healthStatus?.currentStatus === "Under Treatment" ||
      a.healthStatus?.currentStatus === "Critical" ||
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

    // Get unique animal types for filter dropdown
    const animalTypes = await Animal.distinct("animalType", { farmer: farmer._id, isActive: true });

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
      // Filter values
      taskFilter,
      statusFilter,
      animalTypeFilter,
      animalTypes,
      pendingCount,
      overdueCount,
      // Role info
      isParavetView,
      isAdminView,
      farmersList: isParavetView || isAdminView ? farmersList : [],
      moment,
      user: req.user
    });
    
  } catch (error) {
    console.error("Error loading dashboard:", error);
    req.flash("error", "Error loading dashboard: " + error.message);
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

    // Get filter parameters
    const search = req.query.search || '';
    const village = req.query.village || '';
    const status = req.query.status || '';
    const paravetId = req.query.paravet || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const taskFilter = req.query.taskFilter || 'all';

    // Build query
    let query = {};
    let farmerIdsForParavet = null;
    
    // 🔥 ROLE-BASED FILTERING FOR PARAVET
    if (req.user.role === "PARAVET") {
      const paravet = await Paravet.findOne({ user: req.user._id });
      
      if (!paravet) {
        req.flash("error", "Paravet profile not found");
        return res.redirect(`/${role}`);
      }
      
      console.log("🔍 Paravet ID:", paravet._id);
      
      // METHOD 1: Direct assignment via Farmer.assignedParavet field
      const directlyAssignedFarmers = await Farmer.find({ 
        assignedParavet: paravet._id,
        isActive: true 
      }).distinct('_id');
      
      console.log(`📌 Directly assigned farmers: ${directlyAssignedFarmers.length}`);
      
      // METHOD 2: Through vaccinations (animals assigned to paravet)
      const assignedVaccinations = await Vaccination.find({ 
        assignedParavet: paravet._id 
      }).distinct('animal');
      
      let farmersFromVaccinations = [];
      if (assignedVaccinations.length > 0) {
        const animalsWithFarmers = await Animal.find({
          _id: { $in: assignedVaccinations },
          isActive: true
        }).select('farmer').lean();
        
        farmersFromVaccinations = [...new Set(
          animalsWithFarmers
            .map(a => a.farmer)
            .filter(id => id)
            .map(id => id.toString())
        )];
      }
      
      console.log(`📌 Farmers from vaccinations: ${farmersFromVaccinations.length}`);
      
      // METHOD 3: Through assignedAreas (area-based assignment)
      let farmersFromAreas = [];
      if (paravet.assignedAreas && paravet.assignedAreas.length > 0) {
        const villages = paravet.assignedAreas.map(area => area.village).filter(v => v);
        const districts = paravet.assignedAreas.map(area => area.district).filter(d => d);
        
        let areaQuery = {};
        if (villages.length > 0) {
          areaQuery['address.village'] = { $in: villages };
        } else if (districts.length > 0) {
          areaQuery['address.district'] = { $in: districts };
        }
        
        if (Object.keys(areaQuery).length > 0) {
          farmersFromAreas = await Farmer.find(areaQuery).distinct('_id');
          farmersFromAreas = farmersFromAreas.map(id => id.toString());
        }
      }
      
      console.log(`📌 Farmers from areas: ${farmersFromAreas.length}`);
      
      // Combine all unique farmer IDs
      const allFarmerIds = [...new Set([
        ...directlyAssignedFarmers.map(id => id.toString()),
        ...farmersFromVaccinations,
        ...farmersFromAreas
      ])];
      
      console.log(`✅ Total unique farmers for this paravet: ${allFarmerIds.length}`);
      console.log("Farmer IDs:", allFarmerIds);
      
      if (allFarmerIds.length === 0) {
        // No farmers assigned - show empty state
        return res.render("admin/farmer/index", {
          currentUser: req.user,
          farmers: [],
          currentPage: page,
          totalPages: 1,
          totalCount: 0,
          limit,
          activeCount: 0,
          monthlyCount: 0,
          avgAnimals: 0,
          searchQuery: search,
          selectedVillage: village,
          statusFilter: status,
          selectedParavet: paravetId,
          uniqueVillages: [],
          paravets: [],
          sortBy,
          sortOrder: sortOrder === 1 ? 'asc' : 'desc',
          taskFilter,
          isParavet: true,
          paravetInfo: paravet,
          moment
        });
      }
      
      // Set query to only these farmers
      query._id = { $in: allFarmerIds };
      farmerIdsForParavet = allFarmerIds;
    }
    
    // Apply search filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { uniqueFarmerId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (village) {
      query['address.village'] = { $regex: village, $options: 'i' };
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    if (paravetId && req.user.role !== "PARAVET") {
      query.assignedParavet = paravetId;
    }

    // Build sort object
    let sortObj = {};
    if (sortBy === 'name') {
      sortObj = { name: sortOrder };
    } else if (sortBy === 'location') {
      sortObj = { 'address.village': sortOrder };
    } else if (sortBy === 'contact') {
      sortObj = { mobileNumber: sortOrder };
    } else {
      sortObj = { createdAt: -1 };
    }

    // Get total count
    let totalCount = await Farmer.countDocuments(query);
    
    // Get farmers with pagination
    let farmers = await Farmer.find(query)
      .populate('assignedParavet', 'user')
      .populate('assignedParavet.user', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`📊 Final: Showing ${farmers.length} farmers out of ${totalCount} total`);

    // For each farmer, get additional stats
    const farmersWithStats = await Promise.all(farmers.map(async (farmer) => {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      // Get animal count
      const animalCount = await Animal.countDocuments({ farmer: farmer._id, isActive: true });
      
      // Get vaccination stats (only for this paravet if applicable)
      let vaccinationQuery = { farmer: farmer._id };
      if (req.user.role === "PARAVET") {
        const paravet = await Paravet.findOne({ user: req.user._id });
        vaccinationQuery.assignedParavet = paravet._id;
      }
      
      const pendingVaccinations = await Vaccination.countDocuments({
        ...vaccinationQuery,
        status: { $in: ["Scheduled", "Payment Pending"] }
      });
      
      const overdueVaccinations = await Vaccination.countDocuments({
        ...vaccinationQuery,
        nextDueDate: { $lt: now },
        status: { $ne: "Completed" }
      });
      
      const upcomingVaccinations = await Vaccination.countDocuments({
        ...vaccinationQuery,
        nextDueDate: { $gte: now, $lte: thirtyDaysFromNow },
        status: { $ne: "Completed" }
      });
      
      const completedVaccinations = await Vaccination.countDocuments({
        ...vaccinationQuery,
        status: "Completed"
      });
      
      // Get last visit date
      const lastVaccination = await Vaccination.findOne({
        ...vaccinationQuery,
        dateAdministered: { $exists: true }
      }).sort({ dateAdministered: -1 }).select("dateAdministered").lean();
      
      // Get location for map
      const hasLocation = farmer.location?.coordinates && 
        farmer.location.coordinates[0] !== 0 && 
        farmer.location.coordinates[1] !== 0;
      
      return {
        ...farmer,
        animalCount,
        pendingVaccinations,
        overdueVaccinations,
        upcomingVaccinations,
        completedVaccinations,
        lastVisitDate: lastVaccination?.dateAdministered,
        hasLocation,
        location: hasLocation ? {
          lat: farmer.location.coordinates[1],
          lng: farmer.location.coordinates[0]
        } : null
      };
    }));
    
    // Apply task filter if needed
    let filteredFarmers = farmersWithStats;
    if (taskFilter === 'pending') {
      filteredFarmers = farmersWithStats.filter(f => f.pendingVaccinations > 0);
    } else if (taskFilter === 'overdue') {
      filteredFarmers = farmersWithStats.filter(f => f.overdueVaccinations > 0);
    } else if (taskFilter === 'upcoming') {
      filteredFarmers = farmersWithStats.filter(f => f.upcomingVaccinations > 0);
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Calculate statistics
    let activeCount = 0;
    let monthlyCount = 0;
    let avgAnimals = 0;
    let uniqueVillages = [];
    let paravets = [];
    
    if (req.user.role === "PARAVET" && farmerIdsForParavet) {
      // For paravet, calculate stats only for assigned farmers
      activeCount = await Farmer.countDocuments({ 
        _id: { $in: farmerIdsForParavet },
        isActive: true 
      });
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      monthlyCount = await Farmer.countDocuments({
        _id: { $in: farmerIdsForParavet },
        createdAt: { $gte: startOfMonth }
      });
      
      const animalCounts = await Animal.aggregate([
        { $match: { farmer: { $in: farmerIdsForParavet }, isActive: true } },
        { $group: { _id: '$farmer', count: { $sum: 1 } } }
      ]);
      const totalAnimals = animalCounts.reduce((sum, a) => sum + a.count, 0);
      avgAnimals = farmerIdsForParavet.length > 0 ? totalAnimals / farmerIdsForParavet.length : 0;
      
      // Get unique villages
      uniqueVillages = await Farmer.distinct('address.village', {
        _id: { $in: farmerIdsForParavet },
        'address.village': { $ne: null, $ne: '' }
      });
    } else {
      activeCount = await Farmer.countDocuments({ isActive: true });
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      monthlyCount = await Farmer.countDocuments({
        createdAt: { $gte: startOfMonth }
      });
      
      const animalCounts = await Animal.aggregate([
        { $group: { _id: '$farmer', count: { $sum: 1 } } }
      ]);
      const totalAnimals = animalCounts.reduce((sum, a) => sum + a.count, 0);
      avgAnimals = totalCount > 0 ? totalAnimals / totalCount : 0;
      
      uniqueVillages = await Farmer.distinct('address.village', {
        'address.village': { $ne: null, $ne: '' }
      });
      
      // Get paravets for filter (admin only)
      paravets = await Paravet.find({ isActive: true })
        .populate('user', 'name')
        .lean();
    }

    if (page > totalPages && totalPages > 0) {
      return res.redirect(`/${role}/farmers?page=${totalPages}`);
    }

    // Get paravet info for Paravet users
    let paravetInfo = null;
    if (req.user.role === "PARAVET") {
      paravetInfo = await Paravet.findOne({ user: req.user._id })
        .populate('user', 'name email')
        .lean();
    }

    res.render("admin/farmer/index", {
      currentUser: req.user,
      farmers: filteredFarmers,
      currentPage: page,
      totalPages,
      totalCount: filteredFarmers.length,
      limit,
      // Statistics
      activeCount,
      monthlyCount,
      avgAnimals: avgAnimals.toFixed(1),
      // Filters
      searchQuery: search,
      selectedVillage: village,
      statusFilter: status,
      selectedParavet: paravetId,
      uniqueVillages,
      paravets,
      // Sorting
      sortBy,
      sortOrder: sortOrder === 1 ? 'asc' : 'desc',
      taskFilter,
      // Role info
      isParavet: req.user.role === "PARAVET",
      paravetInfo,
      // Helper functions
      moment
    });
  } catch (error) {
    console.error("Farmer Index Error:", error);
    req.flash("error", "Unable to load farmer data: " + error.message);
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

const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Vaccination = require("../models/vaccination");
const SalesTeam = require("../models/salesteam");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment");

// ================ SALES FARMER MANAGEMENT ================

// Get farmers added by this sales person
module.exports.farmersIndex = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    // Get filter parameters
    const search = req.query.search || '';
    const village = req.query.village || '';
    const status = req.query.status || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Get sales team member profile
    const salesMember = await SalesTeam.findOne({ user: req.user._id });
    
    if (!salesMember) {
      req.flash("error", "Sales team profile not found");
      return res.redirect("/sales/dashboard");
    }

    // Build query - only farmers added by this sales person
    let query = { 
      registeredBy: req.user._id,
       
    };

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

    // For each farmer, get additional stats
    const farmersWithStats = await Promise.all(farmers.map(async (farmer) => {
      const animalCount = await Animal.countDocuments({ farmer: farmer._id, isActive: true });
      
      const pendingVaccinations = await Vaccination.countDocuments({
        farmer: farmer._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      });
      
      const lastVaccination = await Vaccination.findOne({
        farmer: farmer._id,
        dateAdministered: { $exists: true }
      }).sort({ dateAdministered: -1 }).select("dateAdministered").lean();
      
      const hasLocation = farmer.location?.coordinates && 
        farmer.location.coordinates[0] !== 0 && 
        farmer.location.coordinates[1] !== 0;
      
      return {
        ...farmer,
        animalCount,
        pendingVaccinations,
        lastVisitDate: lastVaccination?.dateAdministered,
        hasLocation,
        location: hasLocation ? {
          lat: farmer.location.coordinates[1],
          lng: farmer.location.coordinates[0]
        } : null
      };
    }));

    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Calculate statistics
    const activeCount = await Farmer.countDocuments({ 
      registeredBy: req.user._id,
      isActive: true 
    });
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyCount = await Farmer.countDocuments({
      registeredBy: req.user._id,
      createdAt: { $gte: startOfMonth }
    });
    
    const animalCounts = await Animal.aggregate([
      { $match: { registeredBy: req.user._id, isActive: true } },
      { $group: { _id: '$farmer', count: { $sum: 1 } } }
    ]);
    const totalAnimals = animalCounts.reduce((sum, a) => sum + a.count, 0);
    const avgAnimals = totalCount > 0 ? totalAnimals / totalCount : 0;

    // Get unique villages
    const uniqueVillages = await Farmer.distinct('address.village', {
      registeredBy: req.user._id,
      'address.village': { $ne: null, $ne: '' }
    });

    // Get paravet info
    const paravets = await Paravet.find({ isActive: true })
      .populate('user', 'name')
      .lean();

    res.render("sales/farmers/index", {
      currentUser: req.user,
      farmers: farmersWithStats,
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      activeCount,
      monthlyCount,
      avgAnimals: avgAnimals.toFixed(1),
      searchQuery: search,
      selectedVillage: village,
      statusFilter: status,
      uniqueVillages,
      paravets,
      sortBy,
      sortOrder: sortOrder === 1 ? 'asc' : 'desc',
      salesMember,
      moment
    });
  } catch (error) {
    console.error("Sales Farmer Index Error:", error);
    req.flash("error", "Unable to load farmer data: " + error.message);
    res.redirect("/sales/dashboard");
  }
};


module.exports.viewFarmer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid farmer ID");
      return res.redirect("/sales/farmers");
    }

    // Get farmer - only if added by this sales person
    const farmer = await Farmer.findOne({ 
      _id: id, 
      registeredBy: req.user._id 
    })
      .populate("assignedParavet", "employeeCode")
      .populate("assignedParavet.user", "name email mobile")
      .lean();

    if (!farmer) {
      req.flash("error", "Farmer not found or you don't have permission");
      return res.redirect("/sales/farmers");
    }

    // Get all animals for this farmer with full details
    const animals = await Animal.find({ farmer: id, isActive: true })
      .populate("registeredBy", "name")
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
      male: 0,
      female: 0
    };

    // Process animals for stats and add additional info
    const animalsWithDetails = await Promise.all(animals.map(async (animal) => {
      // Count by type
      animalStats.byType[animal.animalType] = (animalStats.byType[animal.animalType] || 0) + 1;
      
      // Gender count
      if (animal.gender === 'Male') animalStats.male++;
      if (animal.gender === 'Female') animalStats.female++;
      
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
      
      // Get last vaccination for this animal
      const lastVaccination = await Vaccination.findOne({
        animal: animal._id,
        status: "Completed"
      }).sort({ dateAdministered: -1 }).lean();
      
      // Get next vaccination for this animal
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

    // Get all vaccinations for this farmer
    const vaccinations = await Vaccination.find({ farmer: id })
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ createdAt: -1 })
      .lean();

    const totalVaccinations = vaccinations.length;
    const completedVaccinations = vaccinations.filter(v => v.status === "Completed").length;
    const pendingVaccinations = vaccinations.filter(v => v.status === "Scheduled" || v.status === "Payment Pending").length;
    
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

    // Get recent activities
    const recentVaccinations = vaccinations.slice(0, 5).map(v => ({
      type: 'vaccination',
      title: `${v.vaccineName || v.vaccine?.name} Vaccination`,
      description: `Vaccination administered to ${v.animal?.name || v.animal?.tagNumber || 'animal'}`,
      timestamp: v.dateAdministered || v.createdAt,
      status: v.status
    }));

    const recentAnimals = animals.slice(0, 5).map(a => ({
      type: 'animal',
      title: 'New Animal Added',
      description: `Added ${a.animalType} - ${a.name || 'Unnamed'} (${a.tagNumber || 'No tag'})`,
      timestamp: a.createdAt,
      status: 'completed'
    }));

    const activities = [...recentVaccinations, ...recentAnimals]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    // Get location for map
    const hasLocation = farmer.location?.coordinates && 
      farmer.location.coordinates[0] !== 0 && 
      farmer.location.coordinates[1] !== 0;
    
    const mapUrl = hasLocation ? 
      `https://www.openstreetmap.org/?mlat=${farmer.location.coordinates[1]}&mlon=${farmer.location.coordinates[0]}#map=15/${farmer.location.coordinates[1]}/${farmer.location.coordinates[0]}` : 
      null;

    res.render("sales/farmers/view", {
      title: `${farmer.name} - Farmer Details`,
      farmer,
      animals: animalsWithDetails,
      animalStats,
      vaccinations,
      totalVaccinations,
      completedVaccinations,
      pendingVaccinations,
      upcomingVaccinations,
      overdueVaccinations,
      vaccinationRate,
      activities,
      hasLocation,
      mapUrl,
      currentUser: req.user,
      moment
    });
  } catch (error) {
    console.error("View Farmer Details Error:", error);
    req.flash("error", "Unable to load farmer details: " + error.message);
    res.redirect("/sales/farmers");
  }
};

// Edit farmer form
module.exports.renderEditForm = async (req, res) => {
  try {
    const { id } = req.params;
    
    const farmer = await Farmer.findOne({ 
      _id: id, 
      registeredBy: req.user._id 
    }).populate("registeredBy");
    
    if (!farmer) {
      req.flash("error", "Farmer not found or you don't have permission");
      return res.redirect("/sales/farmers");
    }
    
    res.render("sales/farmers/edit", { farmer });
  } catch (error) {
    console.error("Error in edit form:", error);
    req.flash("error", "Unable to load Farmer edit page");
    res.redirect("/sales/farmers");
  }
};

// Update farmer (edit only, no delete)
module.exports.updateFarmer = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerData = req.body.farmer;

    // Check if farmer belongs to this sales person
    const existingFarmer = await Farmer.findOne({ 
      _id: id, 
      registeredBy: req.user._id 
    });
    
    if (!existingFarmer) {
      req.flash("error", "Farmer not found or you don't have permission");
      return res.redirect("/sales/farmers");
    }

    // Update only allowed fields
    const updateData = {
      name: farmerData.name,
      mobileNumber: farmerData.mobileNumber,
      address: farmerData.address,
      isActive: farmerData.isActive ? true : false
    };

    // Fix GeoJSON location
    if (farmerData.location &&
      farmerData.location.coordinates &&
      farmerData.location.coordinates.length === 2
    ) {
      updateData.location = {
        type: "Point",
        coordinates: [
          Number(farmerData.location.coordinates[0]),
          Number(farmerData.location.coordinates[1]),
        ],
      };
    }

    let farmer = await Farmer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Handle photo update
    if (req.file) {
      farmer.photo = {
        url: req.file.path,
        filename: req.file.filename,
        public_id: req.file.filename,
      };
      await farmer.save();
    }

    if (req.body.removePhoto) {
      farmer.photo = undefined;
      await farmer.save();
    }

    req.flash("success", "Farmer updated successfully");
    res.redirect("/sales/farmers");
  } catch (error) {
    console.error("Error updating farmer:", error);

    if (error.code === 11000) {
      req.flash("error", "Mobile number already exists");
      return res.redirect(`/sales/farmers/${req.params.id}/edit`);
    }

    req.flash("error", "Unable to update farmer");
    res.redirect(`/sales/farmers/${req.params.id}/edit`);
  }
};

// Delete is NOT allowed for sales team
// Instead, they can deactivate
module.exports.toggleFarmerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const farmer = await Farmer.findOne({ 
      _id: id, 
      registeredBy: req.user._id 
    });
    
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
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
    res.status(500).json({ success: false, message: "Unable to update status" });
  }
};

// Export farmers list
module.exports.exportFarmers = async (req, res) => {
  try {
    const farmers = await Farmer.find({ 
      registeredBy: req.user._id,
      isActive: true 
    })
      .select("name mobileNumber address uniqueFarmerId createdAt totalAnimals")
      .lean();

    const fields = [
      "Name", "Mobile", "Village", "Taluka", "District", 
      "Farmer ID", "Total Animals", "Registered On"
    ];
    
    const csvData = farmers.map(f => ({
      Name: f.name,
      Mobile: f.mobileNumber,
      Village: f.address?.village || "",
      Taluka: f.address?.taluka || "",
      District: f.address?.district || "",
      "Farmer ID": f.uniqueFarmerId,
      "Total Animals": f.totalAnimals || 0,
      "Registered On": new Date(f.createdAt).toLocaleDateString()
    }));

    const csv = [fields.join(","), ...csvData.map(row => fields.map(f => `"${row[f] || ''}"`).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=my-farmers-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export error:", error);
    req.flash("error", "Failed to export farmers");
    res.redirect("/sales/farmers");
  }
};

// Get farmer animals
module.exports.getFarmerAnimals = async (req, res) => {
  try {
    const { id } = req.params;
    
    const farmer = await Farmer.findOne({ 
      _id: id, 
      registeredBy: req.user._id 
    });
    
    if (!farmer) {
      req.flash("error", "Farmer not found");
      return res.redirect("/sales/farmers");
    }
    
    const animals = await Animal.find({ farmer: id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    
    res.render("sales/farmers/animals", {
      title: `${farmer.name} - Animals`,
      farmer,
      animals,
      moment,
      currentUser: req.user
    });
  } catch (error) {
    console.error("Error getting farmer animals:", error);
    req.flash("error", "Unable to load animals");
    res.redirect("/sales/farmers");
  }
};
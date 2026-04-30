const Vaccination = require("../models/vaccination");
const Animal = require("../models/animal");
const Farmer = require("../models/farmer");
const Paravet = require("../models/paravet");
const Vaccine = require("../models/vaccine");
const mongoose = require("mongoose");
const moment = require("moment");
const { Parser } = require("json2csv");


// ================ RENDER SCHEDULE PAGE ================
exports.renderSchedulePage = async (req, res) => {
  try {
    const {
      area,
      paravet: paravetId,
      status,
      dueDate,
      species,
      vaccinated: vaccinatedStatus,
      tagStatus,
      farmer: farmerId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    console.log("========== SCHEDULE PAGE DEBUG ==========");
    console.log("Request Query:", req.query);

    // Get all paravets for filter
    const paravets = await Paravet.find({ isActive: true })
      .populate("user", "name email")
      .select("user assignedAreas qualification")
      .lean();

    // Get unique areas from farmers
    const areas = await Farmer.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            district: "$address.district",
            taluka: "$address.taluka",
            village: "$address.village",
          },
        },
      },
      { $sort: { "_id.district": 1, "_id.taluka": 1, "_id.village": 1 } },
    ]);

    // Get all farmers for filter
    const farmers = await Farmer.find({ isActive: true })
      .select("name mobileNumber address.village uniqueFarmerId")
      .sort({ name: 1 })
      .lean();

    // Get statistics
    const stats = await getVaccinationStats();

    // Build filters for vaccinations
    const filters = await buildFilters(req.query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log("Applied Filters:", JSON.stringify(filters, null, 2));

    // 🔧 FIX: Get ALL vaccinations including Completed ones with nextDueDate
    const [vaccinations, totalCount] = await Promise.all([
      Vaccination.find(filters)
        .populate({
          path: "animal",
          select: "name tagNumber animalType breed age gender vaccinationSummary photos",
        })
        .populate("vaccine", "name brand diseaseTarget defaultNextDueMonths boosterIntervalWeeks immunityDurationMonths")
        .populate("farmer", "name address mobileNumber uniqueFarmerId")
        .populate("createdBy", "name")
        .populate("assignedParavet", "user")
        .populate({
          path: "assignedParavet",
          populate: { path: "user", select: "name" }
        })
        .sort({ scheduledDate: 1, nextDueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Vaccination.countDocuments(filters),
    ]);

    console.log(`Found ${totalCount} vaccinations`);

    // Get animals that need tagging (no tag number)
    const untaggedAnimals = await Animal.find({
      isActive: true,
      $or: [
        { tagNumber: null },
        { tagNumber: "" },
        { tagNumber: { $exists: false } }
      ]
    })
      .populate("farmer", "name address mobileNumber uniqueFarmerId")
      .select("name tagNumber animalType breed farmer")
      .limit(20)
      .lean();

    console.log(`Found ${untaggedAnimals.length} untagged animals`);

    // 🔧 FIX: Get animals needing vaccination based on age and type
    const allAnimals = await Animal.find({ isActive: true })
      .populate("farmer", "name")
      .lean();
    
    const animalsNeedingVaccination = [];
    
    for (const animal of allAnimals) {
      // Get recommended vaccines for this animal
      const recommendedVaccines = await getRecommendedVaccinesForAnimal(animal);
      
      // Get existing vaccinations (completed/administered)
      const existingVaccinations = await Vaccination.find({ 
        animal: animal._id,
        status: { $in: ["Administered", "Completed", "Payment Verified"] }
      }).distinct("vaccineName");
      
      // Filter out vaccines that are already given
      const pendingRecommended = recommendedVaccines.filter(v => 
        !existingVaccinations.some(ex => ex && ex.toLowerCase().includes(v.name.toLowerCase()))
      );
      
      if (pendingRecommended.length > 0) {
        animalsNeedingVaccination.push({
          ...animal,
          pendingRecommended,
          pendingCount: pendingRecommended.length,
          reason: `${pendingRecommended.length} vaccine(s) pending`
        });
      }
    }
    
    console.log(`Found ${animalsNeedingVaccination.length} animals needing vaccination`);

    // Group vaccinations by farmer
    const groupedByFarmer = {};
    vaccinations.forEach((vac) => {
      const farmerIdKey = vac.farmer?._id?.toString();
      if (!farmerIdKey) return;
      
      if (!groupedByFarmer[farmerIdKey]) {
        groupedByFarmer[farmerIdKey] = {
          farmer: vac.farmer,
          vaccinations: [],
          totalAnimals: 0,
          vaccinatedCount: 0,
          pendingCount: 0,
          needsTagging: false,
          untaggedCount: 0
        };
      }
      
      // Add untagged count for this farmer
      const farmerUntagged = untaggedAnimals.filter(a => 
        a.farmer?._id?.toString() === farmerIdKey
      ).length;
      groupedByFarmer[farmerIdKey].untaggedCount = farmerUntagged;
      groupedByFarmer[farmerIdKey].needsTagging = farmerUntagged > 0;
      
      groupedByFarmer[farmerIdKey].vaccinations.push(vac);
      groupedByFarmer[farmerIdKey].totalAnimals++;
      
      // Count completed vs pending
      if (vac.status === "Administered" || vac.status === "Completed" || vac.status === "Payment Verified") {
        groupedByFarmer[farmerIdKey].vaccinatedCount++;
      } else {
        groupedByFarmer[farmerIdKey].pendingCount++;
      }
    });

    // Get tagged/untagged animals count
    const tagStats = await Animal.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          tagged: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $ne: ["$tagNumber", null] },
                  { $ne: ["$tagNumber", ""] }
                ] }, 
                1, 
                0
              ] 
            } 
          },
          untagged: { 
            $sum: { 
              $cond: [
                { $or: [
                  { $eq: ["$tagNumber", null] },
                  { $eq: ["$tagNumber", ""] }
                ] }, 
                1, 
                0
              ] 
            } 
          },
        },
      },
    ]);

    // Helper functions for view
    const getStatusClass = (vaccination) => {
      const now = new Date();
      const isOverdue = vaccination.nextDueDate && new Date(vaccination.nextDueDate) < now;
      const isToday = vaccination.scheduledDate && 
        new Date(vaccination.scheduledDate).toDateString() === now.toDateString();

      if (isOverdue) return "status-overdue";
      if (vaccination.status === "Scheduled") {
        if (isToday) return "status-today";
        return "status-scheduled";
      }
      if (vaccination.status === "Administered" || vaccination.status === "Completed" || vaccination.status === "Payment Verified") {
        return "status-completed";
      }
      return "status-pending";
    };

    const formatDate = (date) => {
      if (!date) return "Not set";
      return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    const isOverdue = (date) => {
      if (!date) return false;
      return new Date(date) < new Date();
    };

    const isToday = (date) => {
      if (!date) return false;
      return new Date(date).toDateString() === new Date().toDateString();
    };

    res.render("admin/taskScheduller/schedule", {
      title: "Vaccination Schedule",
      farmName: "Zoopito",
      groupedVaccinations: Object.values(groupedByFarmer),
      untaggedAnimals,
      animalsNeedingVaccination,
      paravets,
      farmers,
      areas: areas.map((a) => a._id),
      stats,
      tagStats: tagStats[0] || { tagged: 0, untagged: 0 },
      filters: req.query,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
      user: req.user,
      moment,
      helpers: {
        getStatusClass,
        formatDate,
        isOverdue,
        isToday,
      },
      viewMode: "schedule",
    });
    
  } catch (error) {
    console.error("Error rendering schedule page:", error);
    req.flash("error", "Error loading schedule page: " + error.message);
    res.redirect("/admin/dashboard");
  }
};

// ================ FIXED: buildFilters ================
async function buildFilters(query) {
  const filters = {};
  const {
    area,
    paravet: paravetId,
    status,
    dueDate,
    species,
    vaccinated: vaccinatedStatus,
    tagStatus,
    farmer: farmerId,
    search,
  } = query;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);
  const monthLater = new Date(today);
  monthLater.setMonth(monthLater.getMonth() + 1);

  // 🔧 FIX: Show ALL vaccinations that are NOT completed (including those with nextDueDate)
  if (!status || status === "all" || status === "pending") {
    filters.$or = [
      { status: { $in: ["Scheduled", "Payment Pending", "Administered"] } },
      { 
        status: { $in: ["Completed", "Payment Verified"] },
        nextDueDate: { $lte: monthLater }
      }
    ];
  }
  
  // If specific status is requested
  if (status && status !== "all" && status !== "pending") {
    if (status === "completed") {
      filters.status = { $in: ["Administered", "Completed", "Payment Verified"] };
    } else if (status === "overdue") {
      filters.$or = [
        { status: { $in: ["Scheduled", "Payment Pending", "Administered"] }, scheduledDate: { $lt: today } },
        { status: { $in: ["Completed", "Payment Verified"] }, nextDueDate: { $lt: today } }
      ];
    } else if (status === "today") {
      filters.$or = [
        { status: { $in: ["Scheduled", "Payment Pending", "Administered"] }, scheduledDate: { $gte: today, $lt: tomorrow } },
        { status: { $in: ["Completed", "Payment Verified"] }, nextDueDate: { $gte: today, $lt: tomorrow } }
      ];
    } else if (status === "week") {
      filters.$or = [
        { status: { $in: ["Scheduled", "Payment Pending", "Administered"] }, scheduledDate: { $gte: today, $lt: weekLater } },
        { status: { $in: ["Completed", "Payment Verified"] }, nextDueDate: { $gte: today, $lt: weekLater } }
      ];
    } else if (status === "month") {
      filters.$or = [
        { status: { $in: ["Scheduled", "Payment Pending", "Administered"] }, scheduledDate: { $gte: today, $lt: monthLater } },
        { status: { $in: ["Completed", "Payment Verified"] }, nextDueDate: { $gte: today, $lt: monthLater } }
      ];
    } else {
      filters.status = status;
    }
  }

  // ============ DUE DATE FILTER ============
  if (dueDate && dueDate !== "all") {
    if (dueDate === "overdue") {
      delete filters.$or;
      filters.$and = [
        {
          $or: [
            { scheduledDate: { $lt: today } },
            { nextDueDate: { $lt: today } }
          ]
        }
      ];
    } else if (dueDate === "today") {
      delete filters.$or;
      filters.$and = [
        {
          $or: [
            { scheduledDate: { $gte: today, $lt: tomorrow } },
            { nextDueDate: { $gte: today, $lt: tomorrow } }
          ]
        }
      ];
    } else if (dueDate === "week") {
      delete filters.$or;
      filters.$and = [
        {
          $or: [
            { scheduledDate: { $gte: today, $lt: weekLater } },
            { nextDueDate: { $gte: today, $lt: weekLater } }
          ]
        }
      ];
    } else if (dueDate === "month") {
      delete filters.$or;
      filters.$and = [
        {
          $or: [
            { scheduledDate: { $gte: today, $lt: monthLater } },
            { nextDueDate: { $gte: today, $lt: monthLater } }
          ]
        }
      ];
    }
  }

  // ============ AREA FILTER ============
  if (area && area !== "all" && area !== "") {
    const farmersInArea = await Farmer.find({
      isActive: true,
      $or: [
        { "address.village": { $regex: area, $options: "i" } },
        { "address.taluka": { $regex: area, $options: "i" } },
        { "address.district": { $regex: area, $options: "i" } }
      ]
    }).select("_id");
    
    const farmerIds = farmersInArea.map(f => f._id);
    if (farmerIds.length > 0) {
      filters.farmer = { $in: farmerIds };
    }
  }

  // ============ FARMER FILTER ============
  if (farmerId && farmerId !== "all" && farmerId !== "") {
    filters.farmer = farmerId;
  }

  // ============ PARAVET FILTER ============
  if (paravetId && paravetId !== "all" && paravetId !== "") {
    if (paravetId === "unassigned") {
      filters.assignedParavet = { $exists: false };
    } else {
      filters.assignedParavet = paravetId;
    }
  }

  // ============ SPECIES FILTER ============
  if (species && species !== "all" && species !== "") {
    const animalsOfSpecies = await Animal.find({
      isActive: true,
      animalType: species,
    }).select("_id");
    const animalIds = animalsOfSpecies.map(a => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    }
  }

  // ============ TAG STATUS FILTER ============
  if (tagStatus === "tagged") {
    const taggedAnimals = await Animal.find({
      isActive: true,
      tagNumber: { $ne: null, $ne: "" }
    }).select("_id");
    const animalIds = taggedAnimals.map(a => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    }
  } else if (tagStatus === "untagged") {
    const untaggedAnimals = await Animal.find({
      isActive: true,
      $or: [
        { tagNumber: null },
        { tagNumber: "" },
        { tagNumber: { $exists: false } }
      ]
    }).select("_id");
    const animalIds = untaggedAnimals.map(a => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    }
  }

  // ============ SEARCH FILTER ============
  if (search && search.trim() !== "") {
    const searchRegex = new RegExp(search.trim(), "i");

    const matchingFarmers = await Farmer.find({
      $or: [
        { name: searchRegex },
        { mobileNumber: searchRegex },
        { uniqueFarmerId: searchRegex },
        { "address.village": searchRegex },
      ],
    }).select("_id");

    const matchingAnimals = await Animal.find({
      $or: [
        { name: searchRegex },
        { tagNumber: searchRegex },
        { uniqueAnimalId: searchRegex },
        { breed: searchRegex },
      ],
    }).select("_id");

    const matchingVaccines = await Vaccine.find({
      $or: [
        { name: searchRegex },
        { diseaseTarget: searchRegex },
        { brand: searchRegex },
      ],
    }).select("_id");

    const searchConditions = [];
    
    if (matchingFarmers.length > 0) {
      searchConditions.push({ farmer: { $in: matchingFarmers.map(f => f._id) } });
    }
    if (matchingAnimals.length > 0) {
      searchConditions.push({ animal: { $in: matchingAnimals.map(a => a._id) } });
    }
    if (matchingVaccines.length > 0) {
      searchConditions.push({ vaccine: { $in: matchingVaccines.map(v => v._id) } });
    }
    
    searchConditions.push({ vaccineName: searchRegex });
    searchConditions.push({ batchNumber: searchRegex });
    searchConditions.push({ administeredBy: searchRegex });
    
    if (searchConditions.length > 0) {
      if (filters.$or) {
        filters.$or = [...filters.$or, ...searchConditions];
      } else {
        filters.$or = searchConditions;
      }
    }
  }

  // Remove empty $and if exists
  if (filters.$and && filters.$and.length === 0) {
    delete filters.$and;
  }

  return filters;
}

// ================ FIXED: bulkScheduleNeedingVaccination ================
exports.bulkScheduleNeedingVaccination = async (req, res) => {
  try {
    const { animalIds, paravetId, scheduledDate, notes } = req.body;
    
    console.log("========== BULK SCHEDULE DEBUG ==========");
    console.log("Animal IDs:", animalIds);
    console.log("Paravet ID:", paravetId);
    console.log("Scheduled Date:", scheduledDate);
    
    if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No animals selected'
      });
    }
    
    if (!paravetId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a paravet'
      });
    }
    
    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Please select a schedule date'
      });
    }
    
    const scheduleDate = new Date(scheduledDate);
    scheduleDate.setHours(0, 0, 0, 0);
    
    // Verify paravet exists
    const paravet = await Paravet.findById(paravetId).populate('user');
    if (!paravet) {
      return res.status(404).json({
        success: false,
        message: 'Paravet not found'
      });
    }
    
    const results = {
      success: [],
      failed: [],
      totalScheduled: 0
    };
    
    for (const animalId of animalIds) {
      try {
        const animal = await Animal.findById(animalId).populate('farmer');
        if (!animal) {
          results.failed.push({ animalId, reason: 'Animal not found' });
          continue;
        }
        
        console.log(`Processing animal: ${animal.name || animal.tagNumber} (${animal.animalType})`);
        
        // Get recommended vaccines for this animal
        const recommendedVaccines = await getRecommendedVaccinesForAnimal(animal);
        console.log(`Recommended vaccines count: ${recommendedVaccines.length}`);
        
        if (recommendedVaccines.length === 0) {
          results.failed.push({ 
            animalId, 
            animalName: animal.name || animal.tagNumber,
            reason: 'No recommended vaccines found for this animal type' 
          });
          continue;
        }
        
        // Get existing vaccinations for this animal
        const existingVaccinations = await Vaccination.find({
          animal: animalId,
          status: { $in: ['Administered', 'Completed', 'Payment Verified'] }
        }).distinct('vaccine');
        
        const existingVaccineIds = existingVaccinations.map(id => id ? id.toString() : null).filter(Boolean);
        
        // Filter vaccines that haven't been given yet
        const pendingVaccines = recommendedVaccines.filter(v => 
          !existingVaccineIds.includes(v._id.toString())
        );
        
        console.log(`Pending vaccines count: ${pendingVaccines.length}`);
        
        if (pendingVaccines.length === 0) {
          results.failed.push({ 
            animalId, 
            animalName: animal.name || animal.tagNumber,
            reason: 'No pending vaccines - all recommended vaccines already given' 
          });
          continue;
        }
        
        // Create scheduled vaccinations for each pending vaccine
        for (const vaccine of pendingVaccines) {
          // Calculate next due date
          let nextDueDate = new Date(scheduleDate);
          if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
            nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
          } else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
          } else if (vaccine.defaultNextDueMonths && vaccine.defaultNextDueMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.defaultNextDueMonths);
          } else {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          }
          
          // Create new scheduled vaccination
          const vaccination = new Vaccination({
            farmer: animal.farmer._id,
            animal: animalId,
            vaccine: vaccine._id,
            vaccineName: vaccine.name,
            vaccineType: vaccine.vaccineType,
            doseNumber: 1,
            totalDosesRequired: 1,
            dosageAmount: vaccine.standardDosage || 1,
            dosageUnit: vaccine.dosageUnit || 'ml',
            administrationMethod: vaccine.administrationRoute || 'Injection',
            injectionSite: 'Subcutaneous',
            scheduledDate: scheduleDate,
            nextDueDate: nextDueDate,
            assignedParavet: paravetId,
            status: 'Scheduled',
            notes: notes || '',
            createdBy: req.user._id,
            source: 'schedule'
          });
          await vaccination.save();
          console.log(`✅ Created scheduled vaccination for ${vaccine.name}`);
        }
        
        // Also assign the farmer to this paravet
        if (animal.farmer && animal.farmer._id) {
          await Paravet.findByIdAndUpdate(paravetId, {
            $addToSet: { assignedFarmers: animal.farmer._id }
          });
        }
        
        results.success.push({
          animalId,
          animalName: animal.name || animal.tagNumber || 'Unnamed',
          vaccinesCount: pendingVaccines.length
        });
        results.totalScheduled++;
        
      } catch (error) {
        console.error(`Error scheduling for animal ${animalId}:`, error.message);
        results.failed.push({ animalId, reason: error.message });
      }
    }
    
    console.log(`✅ Bulk schedule completed: ${results.success.length} success, ${results.failed.length} failed`);
    
    res.json({
      success: true,
      message: `Successfully scheduled ${results.totalScheduled} animals. ${results.success.length} animals processed.`,
      results: results
    });
    
  } catch (error) {
    console.error('Error in bulk schedule:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error scheduling vaccinations'
    });
  }
};

// ================ FIXED: getRecommendedVaccinesForAnimal ================
async function getRecommendedVaccinesForAnimal(animal) {
  try {
    const Vaccine = require("../models/vaccine");
    const allVaccines = await Vaccine.find({ isActive: true });
    
    if (!allVaccines || allVaccines.length === 0) {
      return [];
    }
    
    // Define mandatory vaccines by species
    const mandatoryVaccinesBySpecies = {
      'Cow': ['FMD', 'HS', 'BQ'],
      'Buffalo': ['FMD', 'HS', 'BQ'],
      'Goat': ['PPR', 'FMD', 'Enterotoxemia'],
      'Sheep': ['PPR', 'FMD', 'Enterotoxemia'],
      'Dog': ['Rabies', 'DHPP'],
      'Cat': ['Rabies', 'FVRCP'],
      'Poultry': ['ND', 'IBD'],
    };
    
    const speciesName = animal.animalType;
    const speciesMandatory = mandatoryVaccinesBySpecies[speciesName] || [];
    
    if (speciesMandatory.length === 0) {
      return allVaccines;
    }
    
    // Calculate age in months
    let ageInMonths = 0;
    if (animal.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(animal.dateOfBirth);
      ageInMonths = (today.getFullYear() - birthDate.getFullYear()) * 12;
      ageInMonths += today.getMonth() - birthDate.getMonth();
      if (today.getDate() < birthDate.getDate()) {
        ageInMonths--;
      }
    } else if (animal.age && animal.age.value) {
      if (animal.age.unit === 'Years') ageInMonths = animal.age.value * 12;
      else if (animal.age.unit === 'Months') ageInMonths = animal.age.value;
    }
    
    // Get existing vaccinations
    const existingVaccinations = await Vaccination.find({
      animal: animal._id,
      status: { $in: ['Administered', 'Completed', 'Payment Verified'] }
    }).distinct('vaccineName');
    
    // Filter vaccines that are mandatory, age-appropriate, and not already given
    const recommended = allVaccines.filter(vaccine => {
      const vaccineName = vaccine.name;
      
      const isMandatory = speciesMandatory.some(m => 
        vaccineName && vaccineName.toLowerCase().includes(m.toLowerCase())
      );
      
      if (!isMandatory) return false;
      
      const alreadyGiven = existingVaccinations.some(existing => 
        existing && existing.toLowerCase().includes(vaccineName.toLowerCase())
      );
      
      if (alreadyGiven) return false;
      
      if (ageInMonths < 2 && ageInMonths > 0) return false;
      
      return true;
    });
    
    return recommended;
    
  } catch (error) {
    console.error('Error getting recommended vaccines:', error.message);
    return [];
  }
}

// ================ getVaccinationStats ================
async function getVaccinationStats() {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalScheduled, totalOverdue, todayScheduled, totalCompleted, totalFarmers, totalAnimals] = await Promise.all([
    Vaccination.countDocuments({ status: { $in: ["Scheduled", "Payment Pending", "Administered"] } }),
    Vaccination.countDocuments({
      $or: [
        { status: { $in: ["Scheduled", "Payment Pending"] }, scheduledDate: { $lt: now } },
        { status: "Completed", nextDueDate: { $lt: now } }
      ]
    }),
    Vaccination.countDocuments({
      $or: [
        { status: { $in: ["Scheduled", "Payment Pending"] }, scheduledDate: { $gte: today, $lt: tomorrow } },
        { status: "Completed", nextDueDate: { $gte: today, $lt: tomorrow } }
      ]
    }),
    Vaccination.countDocuments({ status: { $in: ["Administered", "Completed", "Payment Verified"] } }),
    Farmer.countDocuments({ isActive: true }),
    Animal.countDocuments({ isActive: true }),
  ]);

  return {
    totalPending: totalScheduled,
    totalScheduled,
    totalOverdue,
    todayScheduled,
    totalCompleted,
    totalFarmers,
    totalAnimals,
  };
}

// Make sure to export all functions
module.exports.scheduleDate = async (req, res) => {
  try {
    const { vaccinationIds, scheduledDate, notes, paravetId } = req.body;

    let parsedVaccinationIds = vaccinationIds;
    if (typeof vaccinationIds === "string") {
      try {
        parsedVaccinationIds = JSON.parse(vaccinationIds);
      } catch (e) {
        parsedVaccinationIds = vaccinationIds.split(",").map((id) => id.trim());
      }
    }

    if (!Array.isArray(parsedVaccinationIds) || parsedVaccinationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "vaccinationIds must be a non-empty array",
      });
    }

    if (!scheduledDate) {
      return res.status(400).json({
        success: false,
        message: "scheduledDate is required",
      });
    }

    const updateData = {
      scheduledDate: new Date(scheduledDate),
      updatedBy: req.user._id,
      scheduleNotes: notes || "",
    };

    if (paravetId) {
      updateData.assignedParavet = paravetId;
      updateData.status = "Scheduled";
    }

    const result = await Vaccination.updateMany(
      { _id: { $in: parsedVaccinationIds } },
      { $set: updateData },
    );

    res.json({
      success: true,
      message: `Scheduled ${result.modifiedCount} vaccinations for ${new Date(scheduledDate).toLocaleDateString()}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error scheduling date:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports.assignParavetToVaccinations = async (req, res) => {
  try {
    const { paravetId, vaccinationIds, scheduledDate } = req.body;

    const paravet = await Paravet.findById(paravetId).populate("user");
    if (!paravet) {
      throw new Error("Paravet not found");
    }

    const updateData = {
      assignedParavet: paravetId,
      status: "Scheduled",
      scheduledDate: scheduledDate || new Date(),
      updatedBy: req.user._id,
    };

    const result = await Vaccination.updateMany(
      { _id: { $in: vaccinationIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `Successfully assigned ${result.modifiedCount} vaccinations to ${paravet.user?.name}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error assigning paravet:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ================ HELPER: GET ANIMALS NEEDING VACCINATION ================

async function getAnimalsNeedingVaccination() {
  try {
    // Get all active animals
    const animals = await Animal.find({ isActive: true })
      .populate("farmer", "name address mobileNumber")
      .lean();
    
    const animalsNeedingVaccination = [];
    
    for (const animal of animals) {
      // Get completed vaccinations for this animal
      const completedVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Administered", "Completed", "Payment Verified"] }
      }).distinct("vaccine");
      
      // Get scheduled/pending vaccinations
      const pendingVaccinations = await Vaccination.find({
        animal: animal._id,
        status: { $in: ["Scheduled", "Payment Pending"] }
      }).populate("vaccine", "name");
      
      // Get recommended vaccines based on animal type and age
      const recommendedVaccines = await getRecommendedVaccinesForAnimal(animal);
      
      // Filter out vaccines that are already given or scheduled
      const completedVaccineIds = completedVaccinations.map(id => id.toString());
      const scheduledVaccineIds = pendingVaccinations.map(v => v.vaccine?._id?.toString()).filter(Boolean);
      
      const pendingRecommended = recommendedVaccines.filter(v => 
        !completedVaccineIds.includes(v._id.toString()) && 
        !scheduledVaccineIds.includes(v._id.toString())
      );
      
      if (pendingRecommended.length > 0) {
        animalsNeedingVaccination.push({
          ...animal,
          pendingRecommended,
          pendingCount: pendingRecommended.length,
          hasPendingSchedules: pendingVaccinations.length > 0
        });
      }
    }
    
    return animalsNeedingVaccination;
    
  } catch (error) {
    console.error("Error getting animals needing vaccination:", error);
    return [];
  }
}

// ================ GET SINGLE VACCINATION ================
exports.getVaccination = async (req, res) => {
  try {
    const { id } = req.params;

    const vaccination = await Vaccination.findById(id)
      .populate({
        path: "animal",
        select: "name tagNumber animalType breed age gender",
      })
      .populate("vaccine", "name brand diseaseTarget defaultNextDueMonths")
      .populate("farmer", "name address mobileNumber uniqueFarmerId")
      .populate("createdBy", "name")
      //.populate("assignedParavet")
      // .populate({
      //   path: "assignedParavet",
      //   populate: { path: "user", select: "name" },
      // })
      .lean();

    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccination not found" });
    }

    res.json({ success: true, vaccination });
  } catch (error) {
    console.error("Error fetching vaccination:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching vaccination" });
  }
};

// ================ DELETE VACCINATION ================
exports.deleteVaccination = async (req, res) => {
  try {
    const { id } = req.params;

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccination not found" });
    }

    // Remove from animal's history
    await Animal.findByIdAndUpdate(vaccination.animal, {
      $pull: {
        "vaccinationSummary.vaccinesGiven": { vaccine: vaccination.vaccine },
      },
    });

    // Delete the vaccination
    await Vaccination.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Vaccination record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting vaccination:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting vaccination",
    });
  }
};

// ================ GET VACCINATION HISTORY ================
exports.getVaccinationHistory = async (req, res) => {
  try {
    const { animalId } = req.params;

    const vaccinations = await Vaccination.find({ animal: animalId })
      .populate("vaccine", "name brand diseaseTarget")
      .populate("createdBy", "name")
      .sort({ dateAdministered: -1 })
      .lean();

    res.json({
      success: true,
      history: vaccinations,
    });
  } catch (error) {
    console.error("Error fetching vaccination history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching history",
    });
  }
};

// ================ BULK COMPLETE VACCINATIONS ================
exports.bulkCompleteVaccinations = async (req, res) => {
  try {
    const { vaccinationIds, completedDate, notes } = req.body;

    if (
      !vaccinationIds ||
      !Array.isArray(vaccinationIds) ||
      vaccinationIds.length === 0
    ) {
      throw new Error("No vaccination IDs provided");
    }

    const updateData = {
      status: "Completed",
      dateAdministered: completedDate ? new Date(completedDate) : new Date(),
      verificationStatus: "Verified",
      updatedBy: req.user._id,
    };

    if (notes) {
      updateData.verificationNotes = notes;
    }

    const result = await Vaccination.updateMany(
      { _id: { $in: vaccinationIds } },
      { $set: updateData },
    );

    // Update animals' vaccination summary
    const vaccinations = await Vaccination.find({
      _id: { $in: vaccinationIds },
    }).select("animal vaccine vaccineName");

    for (const vac of vaccinations) {
      await Animal.findByIdAndUpdate(vac.animal, {
        $set: {
          "vaccinationSummary.lastVaccinationDate": new Date(),
          "vaccinationSummary.lastVaccineType": vac.vaccineName,
          "vaccinationSummary.isUpToDate": true,
          "vaccinationSummary.lastUpdated": new Date(),
        },
        $inc: { "vaccinationSummary.totalVaccinations": 1 },
        $push: {
          "vaccinationSummary.vaccinesGiven": {
            vaccine: vac.vaccine,
            vaccineName: vac.vaccineName,
            lastDate: new Date(),
            status: "up_to_date",
          },
        },
      });
    }

    res.json({
      success: true,
      message: `Successfully completed ${result.modifiedCount} vaccinations`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in bulk complete:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error completing vaccinations",
    });
  }
};

// ================ GET PENDING VACCINATIONS API ================
exports.getPendingVaccinations = async (req, res) => {
  try {
    const filters = buildFilters(req.query);

    const vaccinations = await Vaccination.find(filters)
      .populate({
        path: "animal",
        select: "name tagNumber animalType breed age gender",
        populate: { path: "farmer", select: "name address mobileNumber" },
      })
      .populate("vaccine", "name brand diseaseTarget")
      .populate("farmer", "name address mobileNumber")
      .sort({ nextDueDate: 1 })
      .lean();

    res.json({ success: true, vaccinations });
  } catch (error) {
    console.error("Error fetching pending vaccinations:", error);
    res.status(500).json({ success: false, message: "Error fetching data" });
  }
};

// ================ GET AREA STATISTICS ================
exports.getAreaStats = async (req, res) => {
  try {
    const stats = await Farmer.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "animals",
          localField: "_id",
          foreignField: "farmer",
          as: "animals",
        },
      },
      {
        $lookup: {
          from: "vaccinations",
          localField: "animals._id",
          foreignField: "animal",
          as: "vaccinations",
        },
      },
      {
        $group: {
          _id: {
            district: "$address.district",
            taluka: "$address.taluka",
            village: "$address.village",
          },
          totalFarmers: { $sum: 1 },
          totalAnimals: { $sum: { $size: "$animals" } },
          totalVaccinations: { $sum: { $size: "$vaccinations" } },
          pendingVaccinations: {
            $sum: {
              $size: {
                $filter: {
                  input: "$vaccinations",
                  as: "vac",
                  cond: {
                    $in: [
                      "$$vac.status",
                      ["Scheduled", "Payment Pending", "Missed"],
                    ],
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { "_id.district": 1, "_id.taluka": 1, "_id.village": 1 } },
    ]);

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error getting area stats:", error);
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
};

// ================ GET FARMER VACCINATIONS ================
exports.getFarmerVaccinations = async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { status, dueDate } = req.query;

    const query = { farmer: farmerId };
    if (status) query.status = status;
    if (dueDate === "overdue") {
      query.nextDueDate = { $lt: new Date() };
    } else if (dueDate === "upcoming") {
      query.nextDueDate = {
        $gte: new Date(),
        $lte: moment().add(30, "days").toDate(),
      };
    }

    const vaccinations = await Vaccination.find(query)
      .populate("animal", "name tagNumber animalType")
      .populate("vaccine", "name diseaseTarget")
      .sort({ nextDueDate: 1 })
      .lean();

    // Group by animal
    const groupedByAnimal = {};
    vaccinations.forEach((vac) => {
      const animalId = vac.animal._id.toString();
      if (!groupedByAnimal[animalId]) {
        groupedByAnimal[animalId] = {
          animal: vac.animal,
          vaccinations: [],
        };
      }
      groupedByAnimal[animalId].vaccinations.push(vac);
    });

    res.json({
      success: true,
      vaccinations: Object.values(groupedByAnimal),
      total: vaccinations.length,
      overdue: vaccinations.filter(
        (v) => v.nextDueDate && new Date(v.nextDueDate) < new Date(),
      ).length,
    });
  } catch (error) {
    console.error("Error fetching farmer vaccinations:", error);
    res.status(500).json({ success: false, message: "Error fetching data" });
  }
};

// ================ GET PARAVET ASSIGNMENTS ================
exports.getParavetAssignments = async (req, res) => {
  try {
    const { area, date } = req.query;

    let query = { isActive: true };
    if (area) {
      query["assignedAreas.village"] = area;
    }

    const paravets = await Paravet.find(query)
      .populate("user", "name email phone")
      .populate("assignedFarmers", "name address totalAnimals")
      .lean();

    // Get assignments for specific date if provided
    let assignments = [];
    if (date) {
      const startDate = moment(date).startOf("day").toDate();
      const endDate = moment(date).endOf("day").toDate();

      assignments = await Vaccination.find({
        scheduledDate: { $gte: startDate, $lte: endDate },
        status: "Scheduled",
      })
        .populate("farmer", "name address")
        .populate("animal", "name tagNumber")
        .lean();
    }

    res.json({
      success: true,
      paravets: paravets.map((p) => ({
        _id: p._id,
        name: p.user?.name || "Unknown",
        email: p.user?.email,
        phone: p.user?.phone,
        assignedAreas: p.assignedAreas,
        assignedFarmers: p.assignedFarmers,
        totalFarmersAssigned: p.assignedFarmers?.length || 0,
        totalServicesCompleted: p.totalServicesCompleted,
        rating: p.rating,
      })),
      assignments,
    });
  } catch (error) {
    console.error("Error getting paravet assignments:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching assignments" });
  }
};

// ================ ASSIGN PARAVET TO VACCINATIONS ================
// ================ BULK ASSIGN PARAVETS ================
exports.bulkAssignParavets = async (req, res) => {
  try {
    const { assignments } = req.body; // Array of { paravetId, vaccinationIds, scheduledDate }

    console.log("Bulk assign request:", assignments);

    if (
      !assignments ||
      !Array.isArray(assignments) ||
      assignments.length === 0
    ) {
      throw new Error("No assignments provided");
    }

    const results = [];
    for (const assign of assignments) {
      const { paravetId, vaccinationIds, scheduledDate } = assign;

      if (
        !paravetId ||
        !vaccinationIds ||
        !Array.isArray(vaccinationIds) ||
        vaccinationIds.length === 0
      ) {
        console.warn("Skipping invalid assignment:", assign);
        continue;
      }

      const paravet = await Paravet.findById(paravetId).populate("user");
      if (!paravet) {
        console.warn("Paravet not found:", paravetId);
        continue;
      }

      const updateResult = await Vaccination.updateMany(
        { _id: { $in: vaccinationIds } },
        {
          $set: {
            assignedParavet: paravetId,
            status: "Scheduled",
            scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
            updatedBy: req.user._id,
          },
        },
      );

      // Get unique farmer IDs from these vaccinations
      const vaccinations = await Vaccination.find({
        _id: { $in: vaccinationIds },
      }).select("farmer");

      const farmerIds = [
        ...new Set(vaccinations.map((v) => v.farmer.toString())),
      ];

      if (farmerIds.length > 0) {
        await Paravet.findByIdAndUpdate(paravetId, {
          $addToSet: {
            assignedFarmers: {
              $each: farmerIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        });
      }

      results.push({
        paravetId,
        paravetName: paravet.user?.name || "Unknown",
        assignedCount: updateResult.modifiedCount,
      });
    }

    res.json({
      success: true,
      message: `Bulk assignment completed. ${results.length} assignments processed.`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error processing bulk assignments",
    });
  }
};

// ================ SCHEDULE DATE ================


// ================ UPDATE VACCINATION STATUS ================
exports.updateVaccinationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, completedDate } = req.body;

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccination not found" });
    }

    vaccination.status = status;
    vaccination.updatedBy = req.user._id;

    if (notes) vaccination.verificationNotes = notes;

    if (status === "Administered" || status === "Completed") {
      vaccination.dateAdministered = completedDate || new Date();
      vaccination.verificationStatus = "Verified";

      // Update animal's vaccination summary
      await Animal.findByIdAndUpdate(vaccination.animal, {
        $set: {
          "vaccinationSummary.lastVaccinationDate": new Date(),
          "vaccinationSummary.lastVaccineType": vaccination.vaccineName,
          "vaccinationSummary.isUpToDate": true,
          "vaccinationSummary.lastUpdated": new Date(),
        },
        $inc: { "vaccinationSummary.totalVaccinations": 1 },
      });
    }

    await vaccination.save();

    res.json({
      success: true,
      message: `Vaccination status updated to ${status}`,
      vaccination,
    });
  } catch (error) {
    console.error("Error updating vaccination status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================ EXPORT SCHEDULE ================
exports.exportSchedule = async (req, res) => {
  try {
    const filters = buildFilters(req.query);

    const vaccinations = await Vaccination.find(filters)
      .populate("farmer", "name mobileNumber address")
      .populate("animal", "name tagNumber animalType breed")
      .populate("vaccine", "name brand diseaseTarget")
      .populate("assignedParavet")
      .populate("createdBy", "name")
      .lean();

    const fields = [
      "Farmer Name",
      "Farmer Mobile",
      "Farmer Village",
      "Animal Name",
      "Animal Tag",
      "Animal Type",
      "Vaccine Name",
      "Disease Target",
      "Dose Number",
      "Total Doses",
      "Date Administered",
      "Next Due Date",
      "Scheduled Date",
      "Assigned Paravet",
      "Status",
      "Payment Status",
      "Created By",
      "Created At",
    ];

    const data = vaccinations.map((v) => ({
      "Farmer Name": v.farmer?.name || "N/A",
      "Farmer Mobile": v.farmer?.mobileNumber || "N/A",
      "Farmer Village": v.farmer?.address?.village || "N/A",
      "Animal Name": v.animal?.name || "N/A",
      "Animal Tag": v.animal?.tagNumber || "N/A",
      "Animal Type": v.animal?.animalType || "N/A",
      "Vaccine Name": v.vaccine?.name || v.vaccineName,
      "Disease Target": v.vaccine?.diseaseTarget || "N/A",
      "Dose Number": v.doseNumber,
      "Total Doses": v.totalDosesRequired,
      "Date Administered": v.dateAdministered
        ? moment(v.dateAdministered).format("DD/MM/YYYY")
        : "N/A",
      "Next Due Date": v.nextDueDate
        ? moment(v.nextDueDate).format("DD/MM/YYYY")
        : "N/A",
      "Scheduled Date": v.scheduledDate
        ? moment(v.scheduledDate).format("DD/MM/YYYY")
        : "N/A",
      "Assigned Paravet": v.assignedParavet?.user?.name || "Not Assigned",
      Status: v.status,
      "Payment Status": v.payment?.paymentStatus || "N/A",
      "Created By": v.createdBy?.name || "N/A",
      "Created At": moment(v.createdAt).format("DD/MM/YYYY HH:mm"),
    }));

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=vaccination-schedule-${moment().format("YYYY-MM-DD")}.csv`,
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting schedule:", error);
    req.flash("error", "Error exporting schedule");
    res.redirect("/admin/vaccination/schedule");
  }
};



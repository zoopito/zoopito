const Vaccination = require("../models/vaccination");
const Animal = require("../models/animal");
const Farmer = require("../models/farmer");
const Paravet = require("../models/paravet");
const Vaccine = require("../models/vaccine");
const mongoose = require("mongoose");
const moment = require("moment");
const { Parser } = require("json2csv");

// ================ RENDER SCHEDULE PAGE ================
// ================ RENDER SCHEDULE PAGE ================
exports.renderSchedulePage = async (req, res) => {
  try {
    const {
      area,
      paravet,
      status,
      dueDate,
      species,
      vaccinated,
      tagStatus,
      farmer,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Get all paravets for filter
    const paravets = await Paravet.find({ isActive: true })
      .populate("user", "name email")
      .select("user assignedAreas qualification");

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
      .sort({ name: 1 });

    // Get statistics
    const stats = await getVaccinationStats();

    // Get pending vaccinations with filters
    const filters = await buildFilters(req.query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pendingVaccinations, totalCount] = await Promise.all([
      Vaccination.find(filters)
        .populate({
          path: "animal",
          select:
            "name tagNumber animalType breed age gender vaccinationSummary",
        })
        .populate("vaccine", "name brand diseaseTarget defaultNextDueMonths")
        .populate(
          "farmer",
          "name address mobileNumber uniqueFarmerId  assignedParavet",
        )
        .populate("createdBy", "name")
        //.populate("assignedParavet", "user")
        // .populate({
        //   path: "assignedParavet",
        //   populate: { path: "user", select: "name" },
        // })
        .sort({ nextDueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Vaccination.countDocuments(filters),
    ]);

    // Group by farmer for better display
    const groupedByFarmer = {};
    pendingVaccinations.forEach((vac) => {
      const farmerId = vac.farmer?._id?.toString();
      if (!groupedByFarmer[farmerId]) {
        groupedByFarmer[farmerId] = {
          farmer: vac.farmer,
          vaccinations: [],
          totalAnimals: 0,
          vaccinatedCount: 0,
          pendingCount: 0,
        };
      }
      groupedByFarmer[farmerId].vaccinations.push(vac);

      if (
        vac.status === "Administered" ||
        vac.status === "Completed" ||
        vac.status === "Payment Verified"
      ) {
        groupedByFarmer[farmerId].vaccinatedCount++;
      } else {
        groupedByFarmer[farmerId].pendingCount++;
      }
      groupedByFarmer[farmerId].totalAnimals++;
    });

    // Get tagged/untagged animals count
    const tagStats = await Animal.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          tagged: { $sum: { $cond: [{ $ne: ["$tagNumber", null] }, 1, 0] } },
          untagged: { $sum: { $cond: [{ $eq: ["$tagNumber", null] }, 1, 0] } },
        },
      },
    ]);

    // Helper functions
    const getStatusClass = (vaccination) => {
      const now = new Date();
      const isOverdue =
        vaccination.nextDueDate && new Date(vaccination.nextDueDate) < now;

      if (isOverdue) return "status-overdue";
      if (vaccination.status === "Scheduled") return "status-scheduled";
      if (
        vaccination.status === "Administered" ||
        vaccination.status === "Completed" ||
        vaccination.status === "Payment Verified"
      )
        return "status-completed";
      if (vaccination.status === "Payment Pending") return "status-pending";
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

    console.log("Filters applied:", filters);
    console.log(`Found ${totalCount} vaccinations`);

    res.render("admin/taskScheduller/schedule", {
      title: "Vaccination Schedule",
      farmName: "Zoopito",
      groupedVaccinations: Object.values(groupedByFarmer),
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
        isOverdue: (date) => date && new Date(date) < new Date(),
      },
      viewMode: "undefined",
    });
  } catch (error) {
    console.error("Error rendering schedule page:", error);
    req.flash("error", "Error loading schedule page");
    res.redirect("/admin/dashboard");
  }
};

// ================ BUILD FILTERS HELPER FUNCTION ================
async function buildFilters(query) {
  const filters = {};
  const {
    area,
    paravet,
    status,
    dueDate,
    species,
    vaccinated,
    tagStatus,
    farmer,
    search,
  } = query;

  // Status filter
  if (status) {
    if (status === "pending") {
      filters.status = { $in: ["Scheduled", "Payment Pending", "Missed"] };
    } else if (status === "completed") {
      filters.status = {
        $in: ["Administered", "Completed", "Payment Verified"],
      };
    } else if (status === "overdue") {
      filters.status = { $in: ["Scheduled", "Payment Pending", "Missed"] };
      filters.nextDueDate = { $lt: new Date() };
    } else {
      filters.status = status;
    }
  }

  // Due date filter
  if (dueDate && dueDate !== "overdue") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate === "today") {
      filters.nextDueDate = {
        $gte: today,
        $lt: tomorrow,
      };
    } else if (dueDate === "week") {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      filters.nextDueDate = {
        $gte: today,
        $lt: nextWeek,
      };
    } else if (dueDate === "month") {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      filters.nextDueDate = {
        $gte: today,
        $lt: nextMonth,
      };
    }
  }

  // Area filter - need to join with farmer
  if (area) {
    const farmersInArea = await Farmer.find({
      isActive: true,
      "address.village": area,
    }).select("_id");
    const farmerIds = farmersInArea.map((f) => f._id);
    if (farmerIds.length > 0) {
      filters.farmer = { $in: farmerIds };
    } else {
      filters.farmer = null; // No results
    }
  }

  // Farmer filter
  if (farmer) {
    filters.farmer = farmer;
  }

  // Paravet filter
  if (paravet) {
    if (paravet === "unassigned") {
      filters.assignedParavet = { $exists: false };
    } else {
      filters.assignedParavet = paravet;
    }
  }

  // Species filter - need to join with animal
  if (species) {
    const animalsOfSpecies = await Animal.find({
      isActive: true,
      animalType: species,
    }).select("_id");
    const animalIds = animalsOfSpecies.map((a) => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    } else {
      filters.animal = null; // No results
    }
  }

  // Vaccinated status filter
  if (vaccinated === "yes") {
    filters.status = { $in: ["Administered", "Completed", "Payment Verified"] };
  } else if (vaccinated === "no") {
    filters.status = { $in: ["Scheduled", "Payment Pending", "Missed"] };
  }

  // Tag status filter - need to join with animal
  if (tagStatus === "tagged") {
    const taggedAnimals = await Animal.find({
      isActive: true,
      tagNumber: { $ne: null },
    }).select("_id");
    const animalIds = taggedAnimals.map((a) => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    } else {
      filters.animal = null;
    }
  } else if (tagStatus === "untagged") {
    const untaggedAnimals = await Animal.find({
      isActive: true,
      tagNumber: null,
    }).select("_id");
    const animalIds = untaggedAnimals.map((a) => a._id);
    if (animalIds.length > 0) {
      filters.animal = { $in: animalIds };
    } else {
      filters.animal = null;
    }
  }

  // Search filter - search across multiple fields
  if (search && search.trim() !== "") {
    const searchRegex = new RegExp(search.trim(), "i");

    // Find farmers matching search
    const matchingFarmers = await Farmer.find({
      $or: [
        { name: searchRegex },
        { mobileNumber: searchRegex },
        { uniqueFarmerId: searchRegex },
        { "address.village": searchRegex },
      ],
    }).select("_id");

    // Find animals matching search
    const matchingAnimals = await Animal.find({
      $or: [
        { name: searchRegex },
        { tagNumber: searchRegex },
        { breed: searchRegex },
      ],
    }).select("_id");

    // Find vaccines matching search
    const matchingVaccines = await Vaccine.find({
      $or: [
        { name: searchRegex },
        { diseaseTarget: searchRegex },
        { brand: searchRegex },
      ],
    }).select("_id");

    filters.$or = [
      { farmer: { $in: matchingFarmers.map((f) => f._id) } },
      { animal: { $in: matchingAnimals.map((a) => a._id) } },
      { vaccine: { $in: matchingVaccines.map((v) => v._id) } },
      { vaccineName: searchRegex },
      { batchNumber: searchRegex },
      { administeredBy: searchRegex },
    ];
  }

  return filters;
}

// ================ GET VACCINATION STATS ================
async function getVaccinationStats() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    totalPending,
    totalScheduled,
    totalOverdue,
    todayScheduled,
    totalCompleted,
    totalFarmers,
    totalAnimals,
  ] = await Promise.all([
    Vaccination.countDocuments({
      status: { $in: ["Scheduled", "Payment Pending", "Missed"] },
    }),
    Vaccination.countDocuments({ status: "Scheduled" }),
    Vaccination.countDocuments({
      status: { $in: ["Scheduled", "Payment Pending", "Missed"] },
      nextDueDate: { $lt: now },
    }),
    Vaccination.countDocuments({
      status: "Scheduled",
      $expr: {
        $eq: [
          {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$scheduledDate",
              timezone: "Asia/Kolkata",
            },
          },
          {
            $dateToString: {
              format: "%Y-%m-%d",
              date: new Date(),
              timezone: "Asia/Kolkata",
            },
          },
        ],
      },
    }),
    Vaccination.countDocuments({
      status: { $in: ["Administered", "Completed", "Payment Verified"] },
    }),
    Farmer.countDocuments({ isActive: true }),
    Animal.countDocuments({ isActive: true }),
  ]);
  const test = await Vaccination.find({ status: "Scheduled" })
    .select("scheduledDate")
    .lean();

  console.log(test);

  return {
    totalPending,
    totalScheduled,
    totalOverdue,
    todayScheduled,
    totalCompleted,
    totalFarmers,
    totalAnimals,
  };
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
exports.assignParavetToVaccinations = async (req, res) => {
  try {
    const { paravetId, vaccinationIds, scheduledDate } = req.body;

    if (!paravetId || !vaccinationIds || vaccinationIds.length === 0) {
      throw new Error("Paravet ID and vaccination IDs are required");
    }

    // Verify paravet exists
    const paravet = await Paravet.findById(paravetId).populate("user");
    if (!paravet) {
      throw new Error("Paravet not found");
    }

    // Update vaccinations
    const updateData = {
      assignedParavet: paravetId,
      status: "Scheduled",
      scheduledDate: scheduledDate || new Date(),
      updatedBy: req.user._id,
    };

    const updatedVaccinations = await Vaccination.updateMany(
      { _id: { $in: vaccinationIds } },
      updateData,
    );

    // Get unique farmer IDs from these vaccinations
    const vaccinations = await Vaccination.find({
      _id: { $in: vaccinationIds },
    }).populate("farmer");

    const farmerIds = [
      ...new Set(vaccinations.map((v) => v.farmer._id.toString())),
    ];

    // Update paravet's assigned farmers
    if (farmerIds.length > 0) {
      await Paravet.findByIdAndUpdate(paravetId, {
        $addToSet: {
          assignedFarmers: {
            $each: farmerIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      });
    }

    res.json({
      success: true,
      message: `Successfully assigned ${updatedVaccinations.modifiedCount} vaccinations to ${paravet.user?.name}`,
      modifiedCount: updatedVaccinations.modifiedCount,
    });
  } catch (error) {
    console.error("Error assigning paravet:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
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
exports.scheduleDate = async (req, res) => {
  try {
    // console.log("Schedule date - Headers:", req.headers);
    // console.log("Schedule date - Body:", req.body);

    // Check if req.body exists
    if (!req.body) {
      console.error("Request body is undefined");
      return res.status(400).json({
        success: false,
        message:
          "Request body is missing. Make sure to send JSON data with Content-Type: application/json",
      });
    }

    const { vaccinationIds, scheduledDate, notes, paravetId } = req.body;

    // Validate required fields
    if (!vaccinationIds) {
      return res.status(400).json({
        success: false,
        message: "vaccinationIds is required in the request body",
      });
    }

    // Parse vaccinationIds if it's a string
    let parsedVaccinationIds = vaccinationIds;
    if (typeof vaccinationIds === "string") {
      try {
        parsedVaccinationIds = JSON.parse(vaccinationIds);
      } catch (e) {
        // If it's a comma-separated string
        parsedVaccinationIds = vaccinationIds.split(",").map((id) => id.trim());
      }
    }

    if (
      !Array.isArray(parsedVaccinationIds) ||
      parsedVaccinationIds.length === 0
    ) {
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

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No vaccinations were updated",
      });
    }

    // console.log("Saving date:", scheduledDate, new Date(scheduledDate));
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

// ================ HELPER FUNCTIONS ================

function buildFilters(query) {
  const filters = {};
  const {
    area,
    paravet,
    status,
    dueDate,
    species,
    vaccinated,
    tagStatus,
    search,
  } = query;

  // Status filter
  if (status) {
    if (status === "pending") {
      filters.status = { $in: ["Scheduled", "Payment Pending", "Missed"] };
    } else if (status === "completed") {
      filters.status = {
        $in: ["Administered", "Completed", "Payment Verified"],
      };
    } else {
      filters.status = status;
    }
  } else {
    // Default: show pending
    filters.status = { $in: ["Scheduled", "Payment Pending", "Missed"] };
  }

  // Due date filter
  if (dueDate) {
    const today = moment().startOf("day").toDate();
    if (dueDate === "overdue") {
      filters.nextDueDate = { $lt: today };
    } else if (dueDate === "today") {
      filters.nextDueDate = {
        $gte: today,
        $lte: moment().endOf("day").toDate(),
      };
    } else if (dueDate === "week") {
      filters.nextDueDate = {
        $gte: today,
        $lte: moment().add(7, "days").endOf("day").toDate(),
      };
    } else if (dueDate === "month") {
      filters.nextDueDate = {
        $gte: today,
        $lte: moment().add(30, "days").endOf("day").toDate(),
      };
    }
  }

  // Area filter
  if (area) {
    filters["farmer.address.village"] = area;
  }

  // Paravet filter
  if (paravet) {
    if (paravet === "unassigned") {
      filters.assignedParavet = { $exists: false };
    } else {
      filters.assignedParavet = paravet;
    }
  }

  // Species filter
  if (species) {
    filters["animal.animalType"] = species;
  }

  // Vaccinated status filter
  if (vaccinated === "yes") {
    filters.dateAdministered = { $exists: true };
  } else if (vaccinated === "no") {
    filters.dateAdministered = { $exists: false };
  }

  // Tag status filter - will need to join with animals
  if (tagStatus === "tagged") {
    // Handled in aggregation
  } else if (tagStatus === "untagged") {
    // Handled in aggregation
  }

  // Search filter
  if (search) {
    filters.$or = [
      { "farmer.name": { $regex: search, $options: "i" } },
      { "farmer.mobileNumber": { $regex: search, $options: "i" } },
      { "animal.name": { $regex: search, $options: "i" } },
      { "animal.tagNumber": { $regex: search, $options: "i" } },
      { vaccineName: { $regex: search, $options: "i" } },
    ];
  }

  return filters;
}

async function getVaccinationStats() {
  const now = new Date();
  const startOfDay = moment().startOf("day").toDate();
  const endOfDay = moment().endOf("day").toDate();

  const [
    totalPending,
    totalScheduled,
    totalOverdue,
    todayScheduled,
    totalCompleted,
    totalFarmers,
    totalAnimals,
    byParavet,
    byStatus,
  ] = await Promise.all([
    Vaccination.countDocuments({
      status: { $in: ["Scheduled", "Payment Pending"] },
    }),
    Vaccination.countDocuments({ status: "Scheduled" }),
    Vaccination.countDocuments({
      status: { $in: ["Scheduled", "Payment Pending"] },
      nextDueDate: { $lt: now },
    }),
    Vaccination.countDocuments({
      status: "Scheduled",
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    }),
    Vaccination.countDocuments({
      status: { $in: ["Administered", "Completed", "Payment Verified"] },
    }),
    Farmer.countDocuments({ isActive: true }),
    Animal.countDocuments({ isActive: true }),
    Vaccination.aggregate([
      { $match: { status: { $in: ["Scheduled", "Payment Pending"] } } },
      { $group: { _id: "$assignedParavet", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "paravets",
          localField: "_id",
          foreignField: "_id",
          as: "paravet",
        },
      },
    ]),
    Vaccination.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  return {
    totalPending,
    totalScheduled,
    totalOverdue,
    todayScheduled,
    totalCompleted,
    totalFarmers,
    totalAnimals,
    byParavet,
    byStatus,
  };
}

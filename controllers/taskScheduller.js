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
      paravet,
      status,
      dueDate,
      species,
      vaccinated,
      tagStatus,
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

    // Get statistics
    const stats = await getVaccinationStats();

    // Get pending vaccinations with filters
    const filters = buildFilters(req.query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pendingVaccinations, totalCount] = await Promise.all([
      Vaccination.find(filters)
        .populate({
          path: "animal",
          select:
            "name tagNumber animalType breed age gender vaccinationSummary",
          populate: { path: "farmer", select: "name address mobileNumber" },
        })
        .populate("vaccine", "name brand diseaseTarget defaultNextDueMonths")
        .populate("farmer", "name address mobileNumber assignedParavet")
        .populate("createdBy", "name")
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

      if (vac.status === "Administered" || vac.status === "Completed") {
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

    const getStatusClass = (vaccination) => {
      const now = new Date();
      const isOverdue =
        vaccination.nextDueDate && new Date(vaccination.nextDueDate) < now;

      if (isOverdue) return "status-overdue";
      if (vaccination.status === "Scheduled") return "status-scheduled";
      if (
        vaccination.status === "Administered" ||
        vaccination.status === "Completed"
      )
        return "status-completed";
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

    res.render("admin/taskScheduller/schedule", {
      title: "Vaccination Schedule",
      farmName: "Zoopito",
      groupedVaccinations: Object.values(groupedByFarmer),
      paravets,
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
    });
  } catch (error) {
    console.error("Error rendering schedule page:", error);
    req.flash("error", "Error loading schedule page");
    res.redirect("/admin/dashboard");
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
  const session = await mongoose.startSession();
  session.startTransaction();

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
      { session },
    );

    // Update paravet's assigned farmers if needed
    const vaccinations = await Vaccination.find({
      _id: { $in: vaccinationIds },
    })
      .populate("farmer")
      .session(session);

    const farmerIds = [
      ...new Set(vaccinations.map((v) => v.farmer._id.toString())),
    ];

    await Paravet.findByIdAndUpdate(
      paravetId,
      {
        $addToSet: {
          assignedFarmers: {
            $each: farmerIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      { session },
    );

    await session.commitTransaction();

    // Send notification to paravet (if implemented)
    // await sendNotification(paravet.user, 'New vaccination assignment', ...);

    res.json({
      success: true,
      message: `Successfully assigned ${updatedVaccinations.modifiedCount} vaccinations to ${paravet.user?.name}`,
      modifiedCount: updatedVaccinations.modifiedCount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error assigning paravet:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ================ BULK ASSIGN PARAVETS ================
exports.bulkAssignParavets = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { assignments } = req.body; // Array of { paravetId, vaccinationIds, scheduledDate }

    const results = [];
    for (const assign of assignments) {
      const { paravetId, vaccinationIds, scheduledDate } = assign;

      const paravet = await Paravet.findById(paravetId).populate("user");
      if (!paravet) continue;

      const updateResult = await Vaccination.updateMany(
        { _id: { $in: vaccinationIds } },
        {
          assignedParavet: paravetId,
          status: "Scheduled",
          scheduledDate: scheduledDate || new Date(),
          updatedBy: req.user._id,
        },
        { session },
      );

      const vaccinations = await Vaccination.find({
        _id: { $in: vaccinationIds },
      })
        .populate("farmer")
        .session(session);

      const farmerIds = [
        ...new Set(vaccinations.map((v) => v.farmer._id.toString())),
      ];

      await Paravet.findByIdAndUpdate(
        paravetId,
        {
          $addToSet: {
            assignedFarmers: {
              $each: farmerIds.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
        },
        { session },
      );

      results.push({
        paravetId,
        paravetName: paravet.user?.name,
        assignedCount: updateResult.modifiedCount,
      });
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Bulk assignment completed",
      results,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error in bulk assignment:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ================ SCHEDULE DATE ================
exports.scheduleDate = async (req, res) => {
  try {
    const { vaccinationIds, scheduledDate, notes } = req.body;

    if (!vaccinationIds || vaccinationIds.length === 0 || !scheduledDate) {
      throw new Error("Vaccination IDs and scheduled date are required");
    }

    const updateData = {
      scheduledDate: new Date(scheduledDate),
      status: "Scheduled",
      updatedBy: req.user._id,
      scheduleNotes: notes,
    };

    const result = await Vaccination.updateMany(
      { _id: { $in: vaccinationIds } },
      updateData,
    );

    res.json({
      success: true,
      message: `Scheduled ${result.modifiedCount} vaccinations for ${moment(scheduledDate).format("DD/MM/YYYY")}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error scheduling date:", error);
    res.status(500).json({ success: false, message: error.message });
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

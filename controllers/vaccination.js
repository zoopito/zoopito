const User = require("../models/user");
const Farmer = require("../models/farmer");
const Animal = require("../models/animal");
const Paravet = require("../models/paravet");
const Servise = require("../models/services");
const SalesTeam = require("../models/salesteam");
const Vaccine = require("../models/vaccine");
const Vaccination = require("../models/vaccination");
const mongoose = require("mongoose");
const crypto = require("crypto");
const salesteam = require("../models/salesteam");

// controllers/vaccinationController.js
exports.vaccinationindex = async (req, res) => {
  try {
    const {
      search,
      status,
      vaccineType,
      animalType,
      page = 1,
      limit = 40,
    } = req.query;

    // Build query
    let query = {};
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    let twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    // Status filter
    if (status === "today") {
      query.dateAdministered = {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    } else if (status === "week") {
      query.dateAdministered = {
        $gte: today,
        $lt: weekFromNow,
      };
    } else if (status === "upcoming") {
      query.dateAdministered = {
        $gte: weekFromNow,
        $lt: twoWeeksFromNow,
      };
    } else if (status === "overdue") {
      query.nextDueDate = { $lt: today };
      query.status = { $ne: "Completed" };
    } else if (status === "blocked") {
      // Find animals that are pregnant in month 6-9
      const blockedAnimals = await Animal.find({
        isPregnant: true,
        pregnancyMonth: { $gte: 6, $lte: 9 },
      }).select("_id");

      query.animal = { $in: blockedAnimals.map((a) => a._id) };

      // Also filter for HS-BQ and Deworming vaccines
      const blockedVaccines = await Vaccine.find({
        $or: [
          { name: { $regex: "hs", $options: "i" } },
          { name: { $regex: "bq", $options: "i" } },
          { diseaseTarget: { $regex: "deworm", $options: "i" } },
        ],
      }).select("_id");

      query.vaccine = { $in: blockedVaccines.map((v) => v._id) };
    }

    // Vaccine type filter
    if (vaccineType) {
      query.vaccine = vaccineType;
    }

    // Search filter
    if (search) {
      // First find matching animals and farmers

      const matchingAnimals = await Animal.find({
        $or: [
          { tagId: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const matchingFarmers = await Farmer.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { village: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      query.$or = [
        { animal: { $in: matchingAnimals.map((a) => a._id) } },
        { farmer: { $in: matchingFarmers.map((f) => f._id) } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Animal type filter
    if (animalType && animalType !== "pregnant") {
      const matchingAnimals = await Animal.find({ species: animalType }).select(
        "_id",
      );
      query.animal = { $in: matchingAnimals.map((a) => a._id) };
    } else if (animalType === "pregnant") {
      const pregnantAnimals = await Animal.find({ isPregnant: true }).select(
        "_id",
      );
      query.animal = { $in: pregnantAnimals.map((a) => a._id) };
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get vaccinations with populated data
    const [vaccinations, total] = await Promise.all([
      Vaccination.find(query)
        .populate(
          "animal",
          "name tagId species gender isPregnant pregnancyMonth",
        )
        .populate("farmer", "name village")
        .populate("vaccine", "name brand diseaseTarget")
        .populate("administeredBy", "name")
        .sort({ dateAdministered: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Vaccination.countDocuments(query),
    ]);

    // Get stats
    const stats = await getVaccinationStats();

    // Get vaccine types for filter dropdown
    const vaccineTypes = await Vaccine.find({ isActive: true })
      .select("name brand diseaseTarget")
      .sort({ name: 1 });

    // Build query string for pagination
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (status) queryParams.set("status", status);
    if (vaccineType) queryParams.set("vaccineType", vaccineType);
    if (animalType) queryParams.set("animalType", animalType);
    const queryString = queryParams.toString()
      ? "&" + queryParams.toString()
      : "";

    res.render("admin/vaccinations/index.ejs", {
      title: "Vaccination Management",
      farmName: "abcd",
      vaccinations,
      stats,
      vaccineTypes,
      search: search || "",
      status: status || "",
      vaccineType: vaccineType || "",
      animalType: animalType || "",
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      startIndex: skip,
      queryString,
      user: req.user,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error", "Error loading vaccination dashboard");
    res.redirect("/");
  }
};

async function getVaccinationStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const [
    totalAnimals,
    pregnantAnimals,
    todayTasks,
    weekTasks,
    upcomingTasks,
    blockedTasks,
  ] = await Promise.all([
    Animal.countDocuments({ isActive: true }),
    Animal.countDocuments({ isPregnant: true }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: today, $lt: tomorrow },
      status: { $ne: "Completed" },
    }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: today, $lt: weekFromNow },
      status: { $ne: "Completed" },
    }),
    Vaccination.countDocuments({
      dateAdministered: { $gte: weekFromNow, $lt: twoWeeksFromNow },
      status: { $ne: "Completed" },
    }),
    // Blocked due to pregnancy
    (async () => {
      const blockedAnimals = await Animal.find({
        isPregnant: true,
        pregnancyMonth: { $gte: 6, $lte: 9 },
      }).select("_id");

      const blockedVaccines = await Vaccine.find({
        $or: [
          { name: { $regex: "hs", $options: "i" } },
          { name: { $regex: "bq", $options: "i" } },
          { diseaseTarget: { $regex: "deworm", $options: "i" } },
        ],
      }).select("_id");

      return Vaccination.countDocuments({
        animal: { $in: blockedAnimals.map((a) => a._id) },
        vaccine: { $in: blockedVaccines.map((v) => v._id) },
        status: { $ne: "Completed" },
      });
    })(),
  ]);

  return {
    totalAnimals,
    pregnantAnimals,
    todayTasks,
    weekTasks,
    upcomingTasks,
    blockedTasks,
    annualVaccinationsPerAnimal: 3, // Based on Maharashtra protocol
  };
}

// controllers/vaccinationController.js

// ================ RENDER NEW FORM ================
exports.renderNewForm = async (req, res) => {
  try {
    const { animalId, farmerId, batch } = req.query;
    const userId = req.user._id;

    const paravet = await Paravet.findOne({ user: userId }).populate("assignedAreas");
    const admin = await User.findOne({ _id: userId, role: "ADMIN" });

    // 🚫 No access
    if (!paravet && !admin) {
      req.flash("error", "Access denied");
      return res.redirect("/admin/vaccinations");
    }

    let farmers = [];

    // ================= ADMIN =================
    if (admin) {
      farmers = await Farmer.find({ isActive: true })
        .select("name address.village uniqueFarmerId")
        .sort({ name: 1 })
        .lean();
      console.log("only admin")
    } else if (paravet) {
      const districts = paravet.assignedAreas.map((area) => area.district);
      const villages = paravet.assignedAreas
        .map((area) => area.village)
        .filter(Boolean);

      let farmerQuery = { isActive: true };

      if (villages.length > 0) {
        farmerQuery["address.village"] = { $in: villages };
      } else if (districts.length > 0) {
        farmerQuery["address.district"] = { $in: districts };
      }

      farmers = await Farmer.find(farmerQuery)
        .select("name address.village uniqueFarmerId phone")
        .sort({ name: 1 });
    } else {
      farmers = await Farmer.find({ isActive: true })
        .select("name address.village uniqueFarmerId")
        .sort({ name: 1 })
        .lean();
    }

    // ================= VACCINES =================
    const vaccines = await Vaccine.find({ isActive: true })
      .select("name brand vaccineType diseaseTarget defaultNextDueMonths dosageUnit standardDosage administrationRoute vaccineCharge actualPrice writtenPrice description")
      .sort({ name: 1 });

    // ================= ANIMALS =================
    let animals = [];
    if (farmerId) {
      animals = await Animal.find({
        farmer: farmerId,
        isActive: true,
      })
        .select("name tagId species uniqueAnimalId")
        .sort({ name: 1 });
    }

    // ================= BATCH =================
    let batchData = null;
    if (batch === "true" && req.session.bulkVaccinationData) {
      batchData = req.session.bulkVaccinationData;
      delete req.session.bulkVaccinationData;
    }

    res.render("admin/vaccinations/new", {
      title: "New Vaccination Record",
      farmName: "abcd",
      vaccines,
      farmers,
      animals,
      batchData,
      preSelectedAnimal: animalId,
      preSelectedFarmer: farmerId,
      paravet,
      user: req.user,
    });

  } catch (error) {
    console.error("Error rendering new form:", error);
    req.flash("error", "Error loading form");
    res.redirect("/admin/vaccinations");
  }
};
// ================ ADD NEW VACCINATION ================
// controllers/vaccination.js

exports.addVaccination = async (req, res) => {
  try {
    const vaccinationData = req.body;
    const userId = req.user._id;

    const paravet = await Paravet.findOne({ user: userId });

    let selectedAnimals = [];

    if (Array.isArray(vaccinationData.animals)) {
      selectedAnimals = vaccinationData.animals;
    } else if (typeof vaccinationData.animals === "string") {
      selectedAnimals = vaccinationData.animals.split(",");
    }

    if (selectedAnimals.length === 0) {
      throw new Error("No animals selected");
    }

    const vaccine = await Vaccine.findById(vaccinationData.vaccine);
    if (!vaccine) {
      throw new Error("Vaccine not found");
    }

    const vaccinePrice = vaccine.vaccineCharge || 0;
    const serviceCharge = paravet?.serviceCharge || 50;
    const totalPerAnimal = vaccinePrice + serviceCharge;
    const totalAmount = totalPerAnimal * selectedAnimals.length;

    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const vaccinations = [];

    for (let i = 0; i < selectedAnimals.length; i++) {
      const animal = await Animal.findById(selectedAnimals[i]);
      if (!animal) continue;

      // Calculate next due date
      let nextDueDate = null;
      if (vaccinationData.nextDueDate) {
        nextDueDate = new Date(vaccinationData.nextDueDate);
      } else if (vaccine.defaultNextDueMonths) {
        nextDueDate = new Date(vaccinationData.dateAdministered || new Date());
        nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.defaultNextDueMonths);
      } else if (vaccine.boosterIntervalWeeks) {
        nextDueDate = new Date(vaccinationData.dateAdministered || new Date());
        nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
      }

      const vaccination = {
        farmer: animal.farmer,
        animal: animal._id,
        vaccine: vaccine._id,
        vaccineName: vaccine.name,
        vaccineType: vaccine.vaccineType,
        batchNumber: vaccinationData.batchNumber,
        expiryDate: vaccinationData.expiryDate,
        doseNumber: vaccinationData.doseNumber || 1,
        totalDosesRequired: vaccinationData.totalDosesRequired || 1,
        administrationMethod: vaccinationData.administrationMethod || "Injection",
        injectionSite: vaccinationData.injectionSite || "Subcutaneous",
        dosageAmount: vaccinationData.dosageAmount || vaccine.standardDosage,
        dosageUnit: vaccinationData.dosageUnit || vaccine.dosageUnit || "ml",
        dateAdministered: vaccinationData.dateAdministered || new Date(),
        nextDueDate: nextDueDate,
        administeredBy: vaccinationData.administeredBy || req.user.name,
        verifiedBy: userId,

        payment: {
          vaccinePrice: vaccinePrice,
          serviceCharge: serviceCharge,
          totalAmount: totalPerAnimal,
          paymentStatus: "Completed",  // ✅ Mark as completed directly
          paymentMethod: vaccinationData.paymentMethod || "Cash",
          paymentDate: new Date(),
        },

        animalCondition: {
          temperature: vaccinationData.temperature,
          weight: vaccinationData.weight,
          bodyConditionScore: vaccinationData.bodyConditionScore,
          isPregnant: vaccinationData.isPregnant === "on",
          isLactating: vaccinationData.isLactating === "on",
          healthNotes: vaccinationData.healthNotes,
        },

        hadAdverseReaction: vaccinationData.hadAdverseReaction === "on",
        adverseReactionDetails: vaccinationData.adverseReactionDetails,
        reactionSeverity: vaccinationData.reactionSeverity,
        notes: vaccinationData.notes,
        followUpInstructions: vaccinationData.followUpInstructions,

        status: "Completed",  // ✅ Mark as completed directly
        verificationStatus: "Verified",  // ✅ Mark as verified directly

        source: selectedAnimals.length > 1 ? "bulk_registration" : "manual_entry",
        registrationBatchId: selectedAnimals.length > 1 ? batchId : undefined,
        registrationBatchIndex: i,
        isBulkRegistration: selectedAnimals.length > 1,
        bulkAnimalCount: selectedAnimals.length,

        createdBy: userId,
      };

      vaccinations.push(vaccination);
    }

    const savedVaccinations = await Vaccination.insertMany(vaccinations);

    // Update animal's vaccination summary
    for (const vac of savedVaccinations) {
      await Animal.findByIdAndUpdate(vac.animal, {
        $set: {
          "vaccinationSummary.lastVaccinationDate": vac.dateAdministered,
          "vaccinationSummary.lastVaccineType": vac.vaccineType,
          "vaccinationSummary.nextVaccinationDate": vac.nextDueDate,
          "vaccinationSummary.isUpToDate": vac.nextDueDate ? vac.nextDueDate > new Date() : true,
          "vaccinationSummary.lastUpdated": new Date(),
        },
        $inc: { "vaccinationSummary.totalVaccinations": 1 },
        $push: {
          "vaccinationSummary.vaccinesGiven": {
            vaccine: vac.vaccine,
            vaccineName: vac.vaccineName,
            lastDate: vac.dateAdministered,
            nextDue: vac.nextDueDate,
            status: vac.nextDueDate && vac.nextDueDate > new Date() ? "up_to_date" : "due_soon",
          },
        },
      });
    }

    req.flash("success", `${savedVaccinations.length} vaccination record(s) created successfully!`);

    // ✅ Redirect directly to vaccinations list page
    const role = req.user.role.toLowerCase();
    if (role === 'admin') {
      res.redirect("/admin/vaccinations");
    } else if (role === 'paravet') {
      res.redirect("/paravet/vaccinations");
    } else {
      res.redirect("/vaccination");
    }

  } catch (error) {
    console.error("Error saving vaccination:", error);
    req.flash("error", error.message || "Error saving vaccination record");
    
    const role = req.user.role.toLowerCase();
    if (role === 'admin') {
      res.redirect("/admin/vaccinations/new");
    } else if (role === 'paravet') {
      res.redirect("/paravet/vaccinations/new");
    } else {
      res.redirect("/vaccination/new");
    }
  }
};
// ================ GET ANIMALS BY FARMER (AJAX) ================
exports.getAnimalsByFarmer = async (req, res) => {
  console.log("animal fetch controller called ");
  try {
    const { farmerId } = req.params;

    const animals = await Animal.find({
      farmer: farmerId,
      isActive: true,
    }).select("name tagId species uniqueAnimalId");

    res.json({ success: true, animals });
  } catch (error) {
    console.error("Error fetching animals:", error);
    res.status(500).json({ success: false, message: "Error fetching animals" });
  }
};

// ================ GET VACCINE PRICE (AJAX) ================
exports.getVaccinePrice = async (req, res) => {
  try {
    const { vaccineId } = req.params;

    const vaccine = await Vaccine.findById(vaccineId).select(
      "name vaccineCharge actualPrice writtenPrice description",
    );

    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    // Get paravet service charge
    const paravet = await Paravet.findOne({ user: req.user._id });
    const serviceCharge = paravet?.serviceCharge || 50;

    res.json({
      success: true,
      vaccine: {
        name: vaccine.name,
        vaccineCharge: vaccine.vaccineCharge || 0,
        actualPrice: vaccine.actualPrice || 0,
        writtenPrice: vaccine.writtenPrice || 0,
        description: vaccine.description,
      },
      serviceCharge,
      totalPerAnimal: (vaccine.vaccineCharge || 0) + serviceCharge,
    });
  } catch (error) {
    console.error("Error fetching vaccine price:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching vaccine price" });
  }
};

// ================ RENDER PAYMENT PAGE ================
exports.renderPaymentPage = async (req, res) => {
  try {
    const pendingPayment = req.session.pendingPayment;

    if (!pendingPayment) {
      req.flash("error", "No pending payment found");
      return res.redirect("/vaccination");
    }

    // Generate UPI QR code data
    const upiId = process.env.UPI_ID || "paravet@okhdfcbank"; // Configure in .env
    const payeeName = process.env.PAYEE_NAME || "Zoopito Paravet Services";
    const amount = pendingPayment.totalAmount;

    // Create UPI payment URI
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Vaccination payment for ${pendingPayment.animalCount} animal(s)`)}`;

    res.render("admin/vaccinations/payment.ejs", {
      title: "Complete Payment",
      farmName: "abcd",
      payment: pendingPayment,
      upiId,
      payeeName,
      upiUrl,
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering payment page:", error);
    req.flash("error", "Error loading payment page");
    res.redirect("/vaccination");
  }
};

// ================ VERIFY PAYMENT (User submits UTR) ================
exports.verifyPayment = async (req, res) => {
  try {
    const { utrNumber, paymentMethod, notes } = req.body;
    const pendingPayment = req.session.pendingPayment;

    if (!pendingPayment) {
      throw new Error("No pending payment found");
    }

    let vaccinations;

    if (pendingPayment.batchId.startsWith("BATCH_")) {
      vaccinations = await Vaccination.find({
        registrationBatchId: pendingPayment.batchId,
      });
    } else {
      vaccinations = await Vaccination.find({
        _id: pendingPayment.batchId,
      });
    }

    if (vaccinations.length === 0) {
      throw new Error("Vaccination records not found");
    }

    for (const vaccination of vaccinations) {
      vaccination.payment.utrNumber = utrNumber;
      vaccination.payment.paymentMethod = paymentMethod || "UPI";
      vaccination.payment.paymentNotes = notes;
      vaccination.payment.paymentDate = new Date();
      vaccination.payment.paymentStatus = "Completed";
      vaccination.status = "Payment Verified";

      await vaccination.save();
    }

    delete req.session.pendingPayment;

    req.flash(
      "success",
      "Payment details submitted successfully. Admin will verify your payment shortly.",
    );

    if (pendingPayment.batchId.startsWith("BATCH_")) {
      res.redirect(`/vaccination/batch/${pendingPayment.batchId}`);
    } else {
      res.redirect(`/vaccination/${pendingPayment.batchId}`);
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    req.flash("error", error.message || "Error processing payment");
    res.redirect("/vaccination/payment");
  }
};
// ================ ADMIN VERIFY PAYMENT ================
exports.adminVerifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    const vaccination = await Vaccination.findById(id);

    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    if (verificationStatus === "Verified") {
      vaccination.payment.paymentStatus = "Verified";
      vaccination.payment.paymentVerifiedBy = req.user._id;
      vaccination.payment.paymentVerifiedAt = new Date();
      vaccination.status = "Administered";
      vaccination.verificationStatus = "Verified";
    } else if (verificationStatus === "Rejected") {
      vaccination.payment.paymentStatus = "Failed";
      vaccination.status = "Payment Pending";
      vaccination.verificationStatus = "Rejected";
    }

    vaccination.verificationNotes = verificationNotes;
    vaccination.updatedBy = req.user._id;

    await vaccination.save();

    req.flash(
      "success",
      `Payment ${verificationStatus.toLowerCase()} successfully`,
    );

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        message: `Payment ${verificationStatus.toLowerCase()} successfully`,
        paymentStatus: vaccination.payment.paymentStatus,
      });
    }

    res.redirect(`/vaccination/${id}`);
  } catch (error) {
    console.error("Error verifying payment:", error);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json({
        success: false,
        message: "Error verifying payment",
      });
    }

    req.flash("error", "Error verifying payment");
    res.redirect(`/vaccination/${req.params.id}`);
  }
};

// ================ VIEW PENDING PAYMENTS (Admin) ================
exports.viewPendingPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [vaccinations, total] = await Promise.all([
      Vaccination.find({
        "payment.paymentStatus": "Completed",
        verificationStatus: "Pending",
      })
        .populate("farmer", "name phone village")
        .populate("animal", "name tagId species")
        .populate("vaccine", "name brand")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vaccination.countDocuments({
        "payment.paymentStatus": "Completed",
        verificationStatus: "Pending",
      }),
    ]);

    res.render("admin/vaccinations/pending-payments", {
      title: "Pending Payment Verifications",
      farmName: "abcd",
      vaccinations,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      user: req.user,
    });
  } catch (error) {
    console.error("Error viewing pending payments:", error);
    req.flash("error", "Error loading pending payments");
    res.redirect("/vaccination");
  }
};

//--------------------------------------//
//----------- render edit for --------------
//-------------------------------------------//
exports.renderEditForm = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id)
      .populate("animal", "name tagId species")
      .populate("farmer", "name village")
      .populate("vaccine", "name brand vaccineType");

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/vaccination");
    }

    const vaccines = await Vaccine.find({ isActive: true })
      .select("name brand vaccineType")
      .sort({ name: 1 });

    res.render("admin/vaccinations/edit", {
      title: "Edit Vaccination Record",
      farmName: "abcd",
      vaccination,
      vaccines,
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering edit form:", error);
    req.flash("error", "Error loading edit form");
    res.redirect("/vaccination");
  }
};

// ================ UPDATE VACCINATION ================
exports.updateVaccination = async (req, res) => {
  try {
    const vaccinationId = req.params.id;
    const updateData = req.body;
    const userId = req.user._id;

    // Prepare update object
    const update = {
      vaccine: updateData.vaccine,
      vaccineName: updateData.vaccineName,
      vaccineType: updateData.vaccineType,
      batchNumber: updateData.batchNumber,
      expiryDate: updateData.expiryDate,
      doseNumber: updateData.doseNumber,
      totalDosesRequired: updateData.totalDosesRequired,
      administrationMethod: updateData.administrationMethod,
      injectionSite: updateData.injectionSite,
      dosageAmount: updateData.dosageAmount,
      dosageUnit: updateData.dosageUnit,
      dateAdministered: updateData.dateAdministered,
      nextDueDate: updateData.nextDueDate,
      administeredBy: updateData.administeredBy,
      animalCondition: {
        temperature: updateData.temperature,
        weight: updateData.weight,
        bodyConditionScore: updateData.bodyConditionScore,
        isPregnant: updateData.isPregnant === "on",
        isLactating: updateData.isLactating === "on",
        healthNotes: updateData.healthNotes,
      },
      hadAdverseReaction: updateData.hadAdverseReaction === "on",
      adverseReactionDetails: updateData.adverseReactionDetails,
      reactionSeverity: updateData.reactionSeverity,
      notes: updateData.notes,
      followUpInstructions: updateData.followUpInstructions,
      status: updateData.status,
      verificationStatus: updateData.verificationStatus,
      verificationNotes: updateData.verificationNotes,
      updatedBy: userId,
    };

    // Check if series is complete
    if (update.doseNumber === update.totalDosesRequired) {
      update.isSeriesComplete = true;
      update.seriesCompletionDate = new Date();
    }

    const vaccination = await Vaccination.findByIdAndUpdate(
      vaccinationId,
      update,
      { new: true, runValidators: true },
    );

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/vaccination");
    }

    req.flash("success", "Vaccination record updated successfully");
    res.redirect(`/vaccination/${vaccinationId}`);
  } catch (error) {
    console.error("Error updating vaccination:", error);
    req.flash("error", "Error updating vaccination record");
    res.redirect(`/vaccination/${req.params.id}/edit`);
  }
};

// ================ VIEW VACCINATION DETAILS ================
//const mongoose = require("mongoose");

exports.viewVaccination = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Invalid vaccination ID");
      return res.redirect("/vaccination");
    }

    const vaccination = await Vaccination.findById(id)
      .populate(
        "animal",
        "name tagId species gender dateOfBirth uniqueAnimalId",
      )
      .populate("farmer", "name village uniqueFarmerId phone")
      .populate("vaccine", "name brand manufacturer diseaseTarget")
      .populate("verifiedBy", "name email")
      .populate("createdBy", "name")
      .populate("updatedBy", "name");

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/vaccination");
    }

    const previousVaccinations = await Vaccination.find({
      animal: vaccination.animal._id,
      vaccine: vaccination.vaccine?._id,
      _id: { $ne: vaccination._id },
      status: { $in: ["Administered", "Completed"] },
    })
      .sort({ dateAdministered: -1 })
      .limit(5)
      .populate("vaccine", "name");

    res.render("admin/vaccinations/view", {
      title: "Vaccination Details",
      farmName: "abcd",
      vaccination,
      previousVaccinations,
      user: req.user,
    });
  } catch (error) {
    console.error("Error viewing vaccination:", error);
    req.flash("error", "Error loading vaccination details");
    res.redirect("/vaccination");
  }
};
// ================ VERIFY STATUS ================
exports.verifyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    const vaccination = await Vaccination.findByIdAndUpdate(
      id,
      {
        verificationStatus,
        verificationNotes,
        verifiedBy: req.user._id,
        updatedBy: req.user._id,
      },
      { new: true },
    );

    if (!vaccination) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    req.flash(
      "success",
      `Vaccination record ${verificationStatus.toLowerCase()} successfully`,
    );

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        message: `Record ${verificationStatus.toLowerCase()} successfully`,
        verificationStatus: vaccination.verificationStatus,
      });
    }

    res.redirect(`/vaccination/${id}`);
  } catch (error) {
    console.error("Error verifying vaccination:", error);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json({
        success: false,
        message: "Error updating verification status",
      });
    }

    req.flash("error", "Error updating verification status");
    res.redirect(`/vaccination/${req.params.id}`);
  }
};

// ================ DELETE VACCINATION ================
exports.deleteVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    // Remove reference from animal
    await Animal.findByIdAndUpdate(vaccination.animal, {
      $pull: { vaccinationHistory: vaccination._id },
    });

    // Delete vaccination
    await Vaccination.findByIdAndDelete(req.params.id);

    req.flash("success", "Vaccination record deleted successfully");

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        message: "Record deleted successfully",
      });
    }

    res.redirect("/admin/vaccinations");
  } catch (error) {
    console.error("Error deleting vaccination:", error);

    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json({
        success: false,
        message: "Error deleting record",
      });
    }

    req.flash("error", "Error deleting vaccination record");
    res.redirect("/admin/vaccinations");
  }
};

// ================ VIEW BATCH DETAILS ================
exports.viewBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const vaccinations = await Vaccination.find({
      registrationBatchId: batchId,
    })
      .populate("animal", "name tagId species")
      .populate("farmer", "name village")
      .populate("vaccine", "name brand")
      .populate("createdBy", "name")
      .sort({ registrationBatchIndex: 1 });

    if (!vaccinations.length) {
      req.flash("error", "Batch not found");
      return res.redirect("/vaccination");
    }

    res.render("admin/vaccinations/batch", {
      title: "Batch Vaccination Details",
      farmName: "abcd",
      vaccinations,
      batchId,
      user: req.user,
    });
  } catch (error) {
    console.error("Error viewing batch:", error);
    req.flash("error", "Error loading batch details");
    res.redirect("/vaccination");
  }
};

// ================ GET ANIMALS BY FARMER (AJAX) ================
exports.getAnimalsByFarmer = async (req, res) => {
  try {
    const { farmerId } = req.params;

    const animals = await Animal.find({
      farmer: farmerId,
      isActive: true,
    }).select("name tagId species");

    res.json({ success: true, animals });
  } catch (error) {
    console.error("Error fetching animals:", error);
    res.status(500).json({ success: false, message: "Error fetching animals" });
  }
};

// ================ GET VACCINE DETAILS (AJAX) ================
exports.getVaccineDetails = async (req, res) => {
  try {
    const { vaccineId } = req.params;

    const vaccine = await Vaccine.findById(vaccineId).select(
      "name brand vaccineType defaultNextDueMonths dosageUnit standardDosage administrationRoute",
    );

    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    res.json({ success: true, vaccine });
  } catch (error) {
    console.error("Error fetching vaccine details:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching vaccine details" });
  }
};

// ================ CALCULATE NEXT DUE DATE (AJAX) ================
exports.calculateNextDueDate = async (req, res) => {
  try {
    const { vaccineId, dateAdministered } = req.body;

    const vaccine = await Vaccine.findById(vaccineId);
    if (!vaccine) {
      return res
        .status(404)
        .json({ success: false, message: "Vaccine not found" });
    }

    const adminDate = new Date(dateAdministered);
    let nextDueDate = new Date(adminDate);

    if (vaccine.defaultNextDueMonths) {
      nextDueDate.setMonth(
        nextDueDate.getMonth() + vaccine.defaultNextDueMonths,
      );
    } else if (vaccine.boosterIntervalWeeks) {
      nextDueDate.setDate(
        nextDueDate.getDate() + vaccine.boosterIntervalWeeks * 7,
      );
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }

    res.json({
      success: true,
      nextDueDate: nextDueDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error calculating next due date:", error);
    res
      .status(500)
      .json({ success: false, message: "Error calculating next due date" });
  }
};

// ================ RECORD VACCINATION (Paravet Submission) ================
exports.recordVaccination = async (req, res) => {
  try {
    const { animalId } = req.params;
    const { vaccineId, dateAdministered, doseNumber, totalDosesRequired, injectionSite, dosageAmount, dosageUnit, notes, hadAdverseReaction, adverseReactionDetails, temperature, weight, bodyConditionScore } = req.body;

    // Fetch vaccine details
    const vaccine = await Vaccine.findById(vaccineId);
    if (!vaccine) {
      return res.status(404).json({ success: false, message: "Vaccine not found" });
    }

    // Fetch animal and calculate next due date
    const animal = await Animal.findById(animalId);
    if (!animal) {
      return res.status(404).json({ success: false, message: "Animal not found" });
    }

    const adminDate = new Date(dateAdministered);
    let nextDueDate = new Date(adminDate);

    // Calculate next due date based on vaccine settings
    if (vaccine.boosterIntervalWeeks) {
      nextDueDate.setDate(nextDueDate.getDate() + vaccine.boosterIntervalWeeks * 7);
    } else if (vaccine.immunityDurationMonths) {
      nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }

    // Update vaccination record
    const vaccination = await Vaccination.findOneAndUpdate(
      {
        animal: animalId,
        vaccine: vaccineId,
        status: "Scheduled"
      },
      {
        dateAdministered: adminDate,
        doseNumber: doseNumber || 1,
        totalDosesRequired: totalDosesRequired || 1,
        administeredBy: req.user.name,
        injectionSite: injectionSite || "Subcutaneous",
        dosageAmount: dosageAmount,
        dosageUnit: dosageUnit || vaccine.dosageUnit || "ml",
        status: "Administered",
        nextDueDate: nextDueDate,
        animalCondition: {
          temperature: temperature,
          weight: weight,
          bodyConditionScore: bodyConditionScore,
          isPregnant: animal.pregnancyStatus?.isPregnant || false,
          isLactating: false
        },
        hadAdverseReaction: hadAdverseReaction === "true" || hadAdverseReaction === true,
        adverseReactionDetails: adverseReactionDetails || "",
        notes: notes || "",
        updatedBy: req.user._id,
        verificationStatus: "Pending" // Pending admin verification
      },
      { new: true }
    );

    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }

    // Update animal's next vaccination date
    await Animal.findByIdAndUpdate(
      animalId,
      {
        $set: {
          "vaccinationSummary.nextVaccinationDate": nextDueDate,
          "vaccinationSummary.lastVaccinationDate": adminDate,
          "vaccinationSummary.totalVaccinations": (animal.vaccinationSummary?.totalVaccinations || 0) + 1
        }
      }
    );

    req.flash("success", "Vaccination recorded successfully. Pending admin verification.");
    res.json({
      success: true,
      message: "Vaccination recorded successfully",
      vaccination: vaccination,
      nextDueDate: nextDueDate.toISOString().split("T")[0]
    });

  } catch (error) {
    console.error("Error recording vaccination:", error);
    res.status(500).json({ success: false, message: error.message || "Error recording vaccination" });
  }
};

// ================ COMPLETE VACCINATION (Mark complete & auto-calculate next) ================
// controllers/taskScheduller.js - Add/Update these functions

/**
 * Complete a vaccination and automatically calculate next due date
 */
exports.completeVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionDate, batchNumber, notes, animalCondition } = req.body;

    // Find vaccination with populated vaccine and animal
    const vaccination = await Vaccination.findById(id)
      .populate('vaccine')
      .populate('animal');

    if (!vaccination) {
      return res.status(404).json({
        success: false,
        message: 'Vaccination record not found'
      });
    }

    // Check if already completed
    if (vaccination.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Vaccination already completed'
      });
    }

    const completeDate = completionDate ? new Date(completionDate) : new Date();
    completeDate.setHours(0, 0, 0, 0);

    // Calculate next due date based on vaccine
    let nextDueDate = null;
    let boosterInterval = null;

    if (vaccination.vaccine) {
      const vaccine = vaccination.vaccine;
      
      // Priority 1: Booster Interval Weeks
      if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
        nextDueDate = new Date(completeDate);
        nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
        boosterInterval = `${vaccine.boosterIntervalWeeks} weeks`;
      }
      // Priority 2: Immunity Duration Months
      else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
        nextDueDate = new Date(completeDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
        boosterInterval = `${vaccine.immunityDurationMonths} months`;
      }
      // Priority 3: Default Next Due Months
      else if (vaccine.defaultNextDueMonths && vaccine.defaultNextDueMonths > 0) {
        nextDueDate = new Date(completeDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.defaultNextDueMonths);
        boosterInterval = `${vaccine.defaultNextDueMonths} months`;
      }
      // Default: 1 year
      else {
        nextDueDate = new Date(completeDate);
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        boosterInterval = '1 year';
      }
    } else {
      // Fallback if no vaccine data
      nextDueDate = new Date(completeDate);
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      boosterInterval = '1 year';
    }

    // Update vaccination record
    vaccination.status = 'Completed';
    vaccination.verificationStatus = 'Verified';
    vaccination.dateAdministered = completeDate;
    vaccination.nextDueDate = nextDueDate;
    vaccination.verifiedBy = req.user._id;
    vaccination.verifiedAt = new Date();
    
    if (batchNumber) vaccination.batchNumber = batchNumber;
    if (notes) vaccination.notes = notes;
    
    // Update animal condition if provided
    if (animalCondition) {
      vaccination.animalCondition = {
        ...vaccination.animalCondition,
        ...animalCondition,
        recordedAt: new Date()
      };
    }

    // Check if this is the last dose in a series
    if (vaccination.doseNumber >= vaccination.totalDosesRequired) {
      vaccination.isSeriesComplete = true;
      vaccination.seriesCompletionDate = new Date();
    } else {
      vaccination.doseNumber += 1;
    }

    await vaccination.save();

    // Update animal's vaccination summary
    await updateAnimalVaccinationSummary(vaccination.animal._id, vaccination);

    // Create next scheduled vaccination if needed (for multi-dose series)
    if (!vaccination.isSeriesComplete && vaccination.vaccine) {
      await createNextScheduledVaccination(vaccination, nextDueDate, req.user._id);
    }

    console.log(`✅ Vaccination ${id} completed. Next due: ${nextDueDate.toISOString().split('T')[0]} (${boosterInterval})`);

    res.json({
      success: true,
      message: `Vaccination completed successfully! Next due date: ${nextDueDate.toLocaleDateString()}`,
      data: {
        vaccinationId: vaccination._id,
        completedDate: completeDate,
        nextDueDate: nextDueDate,
        nextDueDateFormatted: nextDueDate.toLocaleDateString(),
        boosterInterval: boosterInterval,
        isSeriesComplete: vaccination.isSeriesComplete,
        doseNumber: vaccination.doseNumber,
        totalDoses: vaccination.totalDosesRequired
      }
    });

  } catch (error) {
    console.error('Error completing vaccination:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing vaccination'
    });
  }
};

/**
 * Update animal's vaccination summary after completion
 */
async function updateAnimalVaccinationSummary(animalId, vaccination) {
  try {
    const animal = await Animal.findById(animalId);
    if (!animal) return;

    // Get all completed vaccinations for this animal
    const allVaccinations = await Vaccination.find({
      animal: animalId,
      status: 'Completed'
    }).sort({ dateAdministered: -1 });

    // Find earliest next due date from all vaccinations
    let earliestNextDue = null;
    for (const vac of allVaccinations) {
      if (vac.nextDueDate && vac.nextDueDate > new Date()) {
        if (!earliestNextDue || vac.nextDueDate < earliestNextDue) {
          earliestNextDue = vac.nextDueDate;
        }
      }
    }

    // Update or create vaccination summary
    if (!animal.vaccinationSummary) {
      animal.vaccinationSummary = {
        totalVaccinations: 0,
        vaccinesGiven: [],
        isUpToDate: false,
        lastUpdated: new Date()
      };
    }

    // Update summary fields
    animal.vaccinationSummary.totalVaccinations = allVaccinations.length;
    animal.vaccinationSummary.lastVaccinationDate = vaccination.dateAdministered;
    animal.vaccinationSummary.lastVaccineType = vaccination.vaccineName;
    animal.vaccinationSummary.nextVaccinationDate = earliestNextDue;
    animal.vaccinationSummary.isUpToDate = !earliestNextDue || earliestNextDue <= new Date();
    animal.vaccinationSummary.lastUpdated = new Date();

    // Update individual vaccine record in the array
    const vaccineIndex = animal.vaccinationSummary.vaccinesGiven.findIndex(
      v => v.vaccine && v.vaccine.toString() === vaccination.vaccine?.toString()
    );

    const vaccineRecord = {
      vaccine: vaccination.vaccine,
      vaccineName: vaccination.vaccineName,
      lastDate: vaccination.dateAdministered,
      nextDue: vaccination.nextDueDate,
      status: vaccination.nextDueDate && vaccination.nextDueDate > new Date() ? 'up_to_date' : 'due_soon'
    };

    if (vaccineIndex >= 0) {
      animal.vaccinationSummary.vaccinesGiven[vaccineIndex] = vaccineRecord;
    } else {
      animal.vaccinationSummary.vaccinesGiven.push(vaccineRecord);
    }

    await animal.save();
    console.log(`✅ Updated vaccination summary for animal ${animalId}`);

  } catch (error) {
    console.error('Error updating animal vaccination summary:', error);
  }
}

/**
 * Create next scheduled vaccination for multi-dose series
 */
async function createNextScheduledVaccination(vaccination, nextDueDate, userId) {
  try {
    // Check if next dose already exists
    const existingNext = await Vaccination.findOne({
      animal: vaccination.animal._id,
      vaccine: vaccination.vaccine._id,
      doseNumber: vaccination.doseNumber + 1,
      status: { $in: ['Scheduled', 'Payment Pending'] }
    });

    if (existingNext) {
      // Update existing scheduled vaccination
      existingNext.scheduledDate = nextDueDate;
      existingNext.nextDueDate = nextDueDate;
      existingNext.updatedBy = userId;
      await existingNext.save();
      console.log(`✅ Updated existing scheduled dose ${vaccination.doseNumber + 1}`);
      return;
    }

    // Create new scheduled vaccination for next dose
    const nextVaccination = new Vaccination({
      farmer: vaccination.farmer,
      animal: vaccination.animal._id,
      vaccine: vaccination.vaccine._id,
      vaccineName: vaccination.vaccineName,
      vaccineType: vaccination.vaccineType,
      doseNumber: vaccination.doseNumber + 1,
      totalDosesRequired: vaccination.totalDosesRequired,
      dosageAmount: vaccination.dosageAmount,
      dosageUnit: vaccination.dosageUnit,
      administrationMethod: vaccination.administrationMethod,
      injectionSite: vaccination.injectionSite,
      scheduledDate: nextDueDate,
      nextDueDate: nextDueDate,
      status: 'Scheduled',
      payment: {
        vaccinePrice: vaccination.payment?.vaccinePrice || 0,
        serviceCharge: vaccination.payment?.serviceCharge || 0,
        totalAmount: (vaccination.payment?.vaccinePrice || 0) + (vaccination.payment?.serviceCharge || 0),
        paymentStatus: 'Pending'
      },
      createdBy: userId,
      source: 'schedule'
    });

    await nextVaccination.save();
    console.log(`✅ Created scheduled dose ${vaccination.doseNumber + 1} for animal ${vaccination.animal._id}`);

  } catch (error) {
    console.error('Error creating next scheduled vaccination:', error);
  }
}

/**
 * Bulk complete multiple vaccinations
 */
exports.bulkCompleteVaccinations = async (req, res) => {
  try {
    const { vaccinationIds, completionDate, batchNumber, notes } = req.body;

    if (!vaccinationIds || !Array.isArray(vaccinationIds) || vaccinationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No vaccination IDs provided'
      });
    }

    const results = {
      success: [],
      failed: [],
      totalCompleted: 0
    };

    for (const vacId of vaccinationIds) {
      try {
        const vaccination = await Vaccination.findById(vacId)
          .populate('vaccine')
          .populate('animal');

        if (!vaccination) {
          results.failed.push({ id: vacId, reason: 'Not found' });
          continue;
        }

        if (vaccination.status === 'Completed') {
          results.failed.push({ id: vacId, reason: 'Already completed' });
          continue;
        }

        const completeDate = completionDate ? new Date(completionDate) : new Date();
        completeDate.setHours(0, 0, 0, 0);

        // Calculate next due date
        let nextDueDate = new Date(completeDate);
        if (vaccination.vaccine) {
          const vaccine = vaccination.vaccine;
          if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
            nextDueDate.setDate(nextDueDate.getDate() + (vaccine.boosterIntervalWeeks * 7));
          } else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.immunityDurationMonths);
          } else if (vaccine.defaultNextDueMonths && vaccine.defaultNextDueMonths > 0) {
            nextDueDate.setMonth(nextDueDate.getMonth() + vaccine.defaultNextDueMonths);
          } else {
            nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          }
        } else {
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        }

        // Update vaccination
        vaccination.status = 'Completed';
        vaccination.verificationStatus = 'Verified';
        vaccination.dateAdministered = completeDate;
        vaccination.nextDueDate = nextDueDate;
        vaccination.verifiedBy = req.user._id;
        vaccination.verifiedAt = new Date();
        if (batchNumber) vaccination.batchNumber = batchNumber;
        if (notes) vaccination.notes = notes;

        await vaccination.save();

        // Update animal summary
        await updateAnimalVaccinationSummary(vaccination.animal._id, vaccination);

        results.success.push({
          id: vacId,
          animalName: vaccination.animal?.name || 'Unknown',
          nextDueDate: nextDueDate.toISOString().split('T')[0]
        });
        results.totalCompleted++;

      } catch (error) {
        console.error(`Error completing vaccination ${vacId}:`, error);
        results.failed.push({ id: vacId, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: `Completed ${results.totalCompleted} vaccinations successfully`,
      results: results
    });

  } catch (error) {
    console.error('Error in bulk complete:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing vaccinations'
    });
  }
};

/**
 * Get vaccine details for next due calculation
 */
exports.getVaccineNextDueInfo = async (req, res) => {
  try {
    const { vaccineId } = req.params;
    
    const vaccine = await Vaccine.findById(vaccineId).select(
      'name boosterIntervalWeeks immunityDurationMonths defaultNextDueMonths'
    );
    
    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Vaccine not found'
      });
    }
    
    let nextDueInfo = {
      hasBooster: false,
      intervalValue: null,
      intervalUnit: null,
      description: 'No booster information available'
    };
    
    if (vaccine.boosterIntervalWeeks && vaccine.boosterIntervalWeeks > 0) {
      nextDueInfo = {
        hasBooster: true,
        intervalValue: vaccine.boosterIntervalWeeks,
        intervalUnit: 'weeks',
        description: `Booster due after ${vaccine.boosterIntervalWeeks} week${vaccine.boosterIntervalWeeks > 1 ? 's' : ''}`
      };
    } else if (vaccine.immunityDurationMonths && vaccine.immunityDurationMonths > 0) {
      nextDueInfo = {
        hasBooster: true,
        intervalValue: vaccine.immunityDurationMonths,
        intervalUnit: 'months',
        description: `Next dose due after ${vaccine.immunityDurationMonths} month${vaccine.immunityDurationMonths > 1 ? 's' : ''}`
      };
    } else if (vaccine.defaultNextDueMonths && vaccine.defaultNextDueMonths > 0) {
      nextDueInfo = {
        hasBooster: true,
        intervalValue: vaccine.defaultNextDueMonths,
        intervalUnit: 'months',
        description: `Next dose due after ${vaccine.defaultNextDueMonths} month${vaccine.defaultNextDueMonths > 1 ? 's' : ''}`
      };
    }
    
    res.json({
      success: true,
      vaccine: {
        id: vaccine._id,
        name: vaccine.name,
        nextDueInfo
      }
    });
    
  } catch (error) {
    console.error('Error getting vaccine next due info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================ ADMIN VERIFY VACCINATION ================
exports.adminVerifyVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }

    if (verificationStatus === "Verified") {
      vaccination.verificationStatus = "Verified";
      vaccination.verifiedBy = req.user._id;
      vaccination.status = "Administered"; // Mark as administered after verification
    } else if (verificationStatus === "Rejected") {
      vaccination.verificationStatus = "Rejected";
      vaccination.status = "Scheduled"; // Revert status if rejected
    }

    vaccination.verificationNotes = verificationNotes || "";
    vaccination.updatedBy = req.user._id;

    await vaccination.save();

    req.flash("success", `Vaccination ${verificationStatus.toLowerCase()} by admin`);
    res.json({
      success: true,
      message: `Vaccination ${verificationStatus.toLowerCase()} successfully`,
      verificationStatus: vaccination.verificationStatus,
      status: vaccination.status
    });

  } catch (error) {
    console.error("Error verifying vaccination:", error);
    res.status(500).json({ success: false, message: error.message || "Error verifying vaccination" });
  }
};

// ================ EDIT NEXT DUE DATE (Admin Testing) ================
exports.editNextDueDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { newNextDueDate } = req.body;

    const vaccination = await Vaccination.findByIdAndUpdate(
      id,
      {
        nextDueDate: new Date(newNextDueDate),
        updatedBy: req.user._id
      },
      { new: true }
    );

    if (!vaccination) {
      return res.status(404).json({ success: false, message: "Vaccination record not found" });
    }

    // Also update animal's next vaccination date if this is the latest
    const animal = await Animal.findById(vaccination.animal);
    if (animal) {
      const latestVaccination = await Vaccination.findOne({
        animal: vaccination.animal,
        status: { $in: ["Administered", "Completed"] }
      }).sort({ dateAdministered: -1 });

      if (latestVaccination && latestVaccination._id.equals(vaccination._id)) {
        await Animal.findByIdAndUpdate(
          vaccination.animal,
          { "vaccinationSummary.nextVaccinationDate": new Date(newNextDueDate) }
        );
      }
    }

    req.flash("success", "Next due date updated successfully");
    res.json({
      success: true,
      message: "Next due date updated successfully",
      nextDueDate: vaccination.nextDueDate.toISOString().split("T")[0]
    });

  } catch (error) {
    console.error("Error editing next due date:", error);
    res.status(500).json({ success: false, message: error.message || "Error editing next due date" });
  }
};

// ================ GET ANIMAL VACCINATION SCHEDULE ================
exports.getAnimalVaccinationSchedule = async (req, res) => {
  try {
    const { animalId } = req.params;

    const animal = await Animal.findById(animalId);
    if (!animal) {
      return res.status(404).json({ success: false, message: "Animal not found" });
    }

    const vaccinations = await Vaccination.find({
      animal: animalId
    })
      .populate("vaccine", "name brand boosterIntervalWeeks immunityDurationMonths diseaseTarget")
      .sort({ scheduledDate: 1 });

    res.json({
      success: true,
      animal: {
        name: animal.name,
        tagNumber: animal.tagNumber,
        species: animal.species,
        nextVaccinationDate: animal.vaccinationSummary?.nextVaccinationDate
      },
      vaccinations: vaccinations
    });

  } catch (error) {
    console.error("Error fetching vaccination schedule:", error);
    res.status(500).json({ success: false, message: error.message || "Error fetching vaccination schedule" });
  }
};

// ================ RENDER VACCINATION RECORDING FORM ================
exports.renderVaccinationRecordForm = async (req, res) => {
  try {
    const userId = req.user._id;
    const paravet = await Paravet.findOne({ user: userId });
    const admin = await User.findOne({ _id: userId, role: "ADMIN" });

    if (!paravet && !admin) {
      req.flash("error", "Access denied");
      return res.redirect("/");
    }

    // Get farmers for paravet
    let farmers = [];
    if (paravet) {
      const districts = paravet.assignedAreas?.map(area => area.district) || [];
      const villages = paravet.assignedAreas?.map(area => area.village).filter(Boolean) || [];
      let farmerQuery = { isActive: true };
      
      if (villages.length > 0) {
        farmerQuery["address.village"] = { $in: villages };
      } else if (districts.length > 0) {
        farmerQuery["address.district"] = { $in: districts };
      }

      farmers = await Farmer.find(farmerQuery).select("name uniqueFarmerId village").sort({ name: 1 });
    } else if (admin) {
      farmers = await Farmer.find({ isActive: true }).select("name uniqueFarmerId village").sort({ name: 1 });
    }

    // Get all active vaccines
    const vaccines = await Vaccine.find({ isActive: true })
      .select("name brand vaccineType diseaseTarget boosterIntervalWeeks immunityDurationMonths")
      .sort({ name: 1 });

    res.render("vaccinations/record", {
      title: "Record Vaccination",
      farmers,
      vaccines,
      user: req.user
    });

  } catch (error) {
    console.error("Error rendering vaccination form:", error);
    req.flash("error", "Error loading form");
    res.redirect("/");
  }
};

// ================ RENDER VACCINATION VERIFICATION/ADMIN PAGE ================
exports.renderVaccinationVerifyPage = async (req, res) => {
  try {
    const { id } = req.params;

    const vaccination = await Vaccination.findById(id)
      .populate("animal", "name tagNumber species pregnancyStatus vaccinations")
      .populate("vaccine", "name brand boosterIntervalWeeks immunityDurationMonths")
      .populate("farmer", "name village mobileNumber");

    if (!vaccination) {
      req.flash("error", "Vaccination record not found");
      return res.redirect("/admin/vaccinations");
    }

    res.render("vaccinations/admin-verify", {
      title: "Verify Vaccination",
      vaccination,
      user: req.user
    });

  } catch (error) {
    console.error("Error rendering verification page:", error);
    req.flash("error", "Error loading verification page");
    res.redirect("/admin/vaccinations");
  }
};

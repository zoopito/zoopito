const Vaccine = require("../models/vaccine");
const Vaccination = require("../models/vaccination");
const Animal = require("../models/animal");

/**
 * Define vaccination schedules by animal type and plan
 */
const VACCINATION_SCHEDULES = {
  Cow: {
    none: [],
    basic: [
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 }, // First dose immediately
      { vaccineName: "HS", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "BQ", interval: 0, doseNumber: 1, totalDoses: 1 },
    ],
    premium: [
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
      { vaccineName: "FMD", interval: 6, doseNumber: 2, totalDoses: 3 },
      { vaccineName: "FMD", interval: 12, doseNumber: 3, totalDoses: 3 },
      { vaccineName: "HS", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "BQ", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Deworming", interval: 3, doseNumber: 1, totalDoses: 4 },
      { vaccineName: "Mineral Mix", interval: 1, doseNumber: 1, totalDoses: 12 },
    ],
  },
  Buffalo: {
    none: [],
    basic: [
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
      { vaccineName: "HS", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "BQ", interval: 0, doseNumber: 1, totalDoses: 1 },
    ],
    premium: [
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
      { vaccineName: "FMD", interval: 6, doseNumber: 2, totalDoses: 3 },
      { vaccineName: "FMD", interval: 12, doseNumber: 3, totalDoses: 3 },
      { vaccineName: "HS", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "BQ", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Deworming", interval: 3, doseNumber: 1, totalDoses: 4 },
      { vaccineName: "Mineral Mix", interval: 1, doseNumber: 1, totalDoses: 12 },
    ],
  },
  Goat: {
    none: [],
    basic: [
      { vaccineName: "PPR", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Enterotoxemia", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
    ],
    premium: [
      { vaccineName: "PPR", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Enterotoxemia", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
      { vaccineName: "FMD", interval: 6, doseNumber: 2, totalDoses: 3 },
      { vaccineName: "FMD", interval: 12, doseNumber: 3, totalDoses: 3 },
      { vaccineName: "Deworming", interval: 3, doseNumber: 1, totalDoses: 4 },
      { vaccineName: "Mineral Mix", interval: 1, doseNumber: 1, totalDoses: 12 },
    ],
  },
  Sheep: {
    none: [],
    basic: [
      { vaccineName: "PPR", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Enterotoxemia", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
    ],
    premium: [
      { vaccineName: "PPR", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "Enterotoxemia", interval: 0, doseNumber: 1, totalDoses: 1 },
      { vaccineName: "FMD", interval: 0, doseNumber: 1, totalDoses: 3 },
      { vaccineName: "FMD", interval: 6, doseNumber: 2, totalDoses: 3 },
      { vaccineName: "FMD", interval: 12, doseNumber: 3, totalDoses: 3 },
      { vaccineName: "Deworming", interval: 3, doseNumber: 1, totalDoses: 4 },
      { vaccineName: "Mineral Mix", interval: 1, doseNumber: 1, totalDoses: 12 },
    ],
  },
};

/**
 * Generate vaccination schedule for an animal based on plan
 * @param {Object} animal - Animal document
 * @param {string} planType - Plan type (none, basic, premium)
 * @param {ObjectId} userId - User creating the record
 * @returns {Promise<Array>} - Array of created vaccination documents
 */
async function generateVaccinationSchedule(animal, planType = "none", userId) {
  try {
    if (!animal || !animal._id) {
      throw new Error("Invalid animal provided");
    }

    const schedule = VACCINATION_SCHEDULES[animal.animalType]?.[planType] || [];

    if (schedule.length === 0) {
      console.log(
        `No vaccinations scheduled for ${animal.animalType} - ${planType} plan`
      );
      return [];
    }

    const createdVaccinations = [];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (const scheduleItem of schedule) {
      try {
        // Find vaccine by name
        const vaccine = await Vaccine.findOne({
          vaccineName: { $regex: scheduleItem.vaccineName, $options: "i" },
          isActive: true,
        });

        if (!vaccine) {
          console.warn(
            `Vaccine "${scheduleItem.vaccineName}" not found for ${animal.animalType}`
          );
          continue;
        }

        // Calculate scheduled date based on interval
        const scheduledDate = new Date(todayDate);
        scheduledDate.setMonth(
          scheduledDate.getMonth() + scheduleItem.interval
        );

        // Calculate next due date
        let nextDueDate = new Date(scheduledDate);
        if (vaccine.defaultNextDueMonths) {
          nextDueDate.setMonth(
            nextDueDate.getMonth() + vaccine.defaultNextDueMonths
          );
        } else if (vaccine.boosterIntervalWeeks) {
          nextDueDate.setDate(
            nextDueDate.getDate() + vaccine.boosterIntervalWeeks * 7
          );
        } else {
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        }

        // Create vaccination record
        const vaccination = new Vaccination({
          farmer: animal.farmer,
          animal: animal._id,
          vaccine: vaccine._id,
          vaccineName: vaccine.vaccineName,
          vaccineType: vaccine.vaccineType,
          doseNumber: scheduleItem.doseNumber,
          totalDosesRequired: scheduleItem.totalDoses,
          dosageAmount: vaccine.standardDosage || 1,
          dosageUnit: vaccine.dosageUnit || "ml",
          administrationMethod: vaccine.administrationRoute || "Injection",
          injectionSite: vaccine.defaultInjectionSite || "Subcutaneous",
          batchNumber: null,
          dateAdministered: scheduledDate,
          scheduledDate: scheduledDate,
          nextDueDate: nextDueDate,
          administeredBy: "System - Scheduled",
          status: "Scheduled",
          payment: {
            vaccinePrice: vaccine.actualPrice || 0,
            serviceCharge: 200, // Fixed service charge
            totalAmount: (vaccine.actualPrice || 0) + 200,
            paymentStatus: "Pending",
            paymentMethod: "Pending",
          },
          createdBy: userId,
          source: "schedule",
        });

        await vaccination.save();
        createdVaccinations.push(vaccination);

        console.log(
          `✅ Scheduled vaccination: ${vaccine.vaccineName} for ${animal.name} on ${scheduledDate.toISOString().split("T")[0]}`
        );
      } catch (error) {
        console.error(
          `Error creating vaccination for ${scheduleItem.vaccineName}:`,
          error.message
        );
        continue;
      }
    }

    // Update animal's vaccination summary if needed
    if (createdVaccinations.length > 0) {
      const nextScheduled = createdVaccinations
        .map((v) => v.nextDueDate)
        .sort((a, b) => a - b)[0];

      animal.vaccinationSummary = {
        nextVaccinationDate: nextScheduled,
        totalDosesScheduled: createdVaccinations.length,
        isUpToDate: false,
      };

      await animal.save();
    }

    return createdVaccinations;
  } catch (error) {
    console.error("Error generating vaccination schedule:", error);
    throw error;
  }
}

/**
 * Update animal's next vaccination date
 * @param {ObjectId} animalId - Animal ID
 * @param {Date} newDate - New vaccination date
 * @param {ObjectId} userId - User making the change
 * @returns {Promise<Object>} - Updated animal document
 */
async function updateAnimalNextVaccinationDate(animalId, newDate, userId) {
  try {
    const animal = await Animal.findByIdAndUpdate(
      animalId,
      {
        $set: {
          "vaccinationSummary.nextVaccinationDate": newDate,
          "vaccinationSummary.lastUpdatedBy": userId,
          "vaccinationSummary.lastUpdatedAt": new Date(),
        },
      },
      { new: true }
    );

    console.log(
      `✅ Updated next vaccination date for animal ${animalId} to ${newDate.toISOString().split("T")[0]}`
    );
    return animal;
  } catch (error) {
    console.error("Error updating next vaccination date:", error);
    throw error;
  }
}

/**
 * Get next vaccination due date for an animal
 * @param {ObjectId} animalId - Animal ID
 * @returns {Promise<Object>} - Next vaccination info
 */
async function getNextVaccinationDue(animalId) {
  try {
    const vaccination = await Vaccination.findOne({
      animal: animalId,
      status: { $in: ["Scheduled", "Payment Pending"] },
      nextDueDate: { $exists: true, $ne: null },
    })
      .populate("vaccine", "name vaccineName")
      .sort({ nextDueDate: 1 });

    return vaccination;
  } catch (error) {
    console.error("Error getting next vaccination:", error);
    throw error;
  }
}

/**
 * Get all scheduled vaccinations for an animal
 * @param {ObjectId} animalId - Animal ID
 * @returns {Promise<Array>} - Array of vaccination records
 */
async function getAnimalVaccinationSchedule(animalId) {
  try {
    const vaccinations = await Vaccination.find({
      animal: animalId,
      status: { $in: ["Scheduled", "Payment Pending", "Administered"] },
    })
      .populate("vaccine", "name vaccineName vaccineType")
      .sort({ nextDueDate: 1 });

    return vaccinations;
  } catch (error) {
    console.error("Error getting vaccination schedule:", error);
    throw error;
  }
}

/**
 * Mark vaccination as completed
 * @param {ObjectId} vaccinationId - Vaccination ID
 * @param {Object} recordData - Vaccination record data (date, signature, etc)
 * @param {ObjectId} userId - User completing the record
 * @returns {Promise<Object>} - Updated vaccination record
 */
async function completeVaccination(vaccinationId, recordData, userId) {
  try {
    const vaccination = await Vaccination.findByIdAndUpdate(
      vaccinationId,
      {
        $set: {
          status: "Administered",
          dateAdministered: recordData.dateAdministered || new Date(),
          administeredBy: recordData.administeredBy || "System",
          animalCondition: recordData.animalCondition,
          hadAdverseReaction: recordData.hadAdverseReaction || false,
          adverseReactionDetails: recordData.adverseReactionDetails,
          verificationStatus: "Verified",
          verifiedBy: userId,
          verifiedAt: new Date(),
          updatedBy: userId,
        },
      },
      { new: true }
    );

    console.log(
      `✅ Marked vaccination ${vaccinationId} as administered`
    );
    return vaccination;
  } catch (error) {
    console.error("Error completing vaccination:", error);
    throw error;
  }
}

module.exports = {
  generateVaccinationSchedule,
  updateAnimalNextVaccinationDate,
  getNextVaccinationDue,
  getAnimalVaccinationSchedule,
  completeVaccination,
  VACCINATION_SCHEDULES,
};

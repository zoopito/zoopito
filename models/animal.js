const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const animalSchema = new Schema(
  {
    // Basic Information
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Animal Identification
    animalType: {
      type: String,
      required: true,
      enum: [
        "Cow",
        "Buffalo",
        "Goat",
        "Sheep",
        "Dog",
        "Cat",
        "Poultry",
        "Other",
      ],
    },
    breed: {
      type: String,
      trim: true,
    },
    tagNumber: {
      type: String,
      required: false,
      unique: true,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    uniqueAnimalId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // NEW: Bulk registration tracking
    registrationBatchId: {
      type: String,
      index: true,
      description: "Group ID for bulk registration",
    },
    registrationBatchIndex: {
      type: Number,
      description: "Index within the bulk registration batch",
    },

    // Physical Attributes
    age: {
      value: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        enum: ["Days", "Months", "Years"],
        default: "Months",
      },
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Unknown"],
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },

    // Photo Documentation
    photos: {
      front: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
      left: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
      right: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
      back: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    },

    // Pregnancy Status - SIMPLIFIED
    pregnancyStatus: {
      isPregnant: {
        type: Boolean,
        default: false,
      },
      kitUsed: String, // Removed enum restriction
      testDate: Date,
      confirmedDate: Date,
      expectedDeliveryDate: Date,
      stage: String, // Removed enum restriction
      numberOfFetuses: {
        type: Number,
        min: 1,
        max: 10,
      },
      previousPregnancies: {
        type: Number,
        min: 0,
        default: 0,
      },
      pregnancyNotes: {
        type: String,
        trim: true,
      },
    },

    // REMOVED: Lactation Status section completely as requested

    // Health Status - SIMPLIFIED
    healthStatus: {
      currentStatus: {
        type: String,
        enum: [
          "Healthy",
          "Sick",
          "Under Treatment",
          "Recovered",
          "Quarantined",
          "Chronic Condition",
        ],
        default: "Healthy",
      },
      lastCheckupDate: Date,
      healthNotes: {
        type: String,
        trim: true,
      },
      bodyConditionScore: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
      },
      // REMOVED: weight tracking, nextCheckupDate
    },

    // Vaccination Summary - ENHANCED
    vaccinationSummary: {
      lastVaccinationDate: Date,
      nextVaccinationDate: Date,
      lastVaccineType: String,
      totalVaccinations: {
        type: Number,
        default: 0,
        min: 0,
      },
      isUpToDate: {
        type: Boolean,
        default: false,
      },
      // NEW: Track individual vaccine status
      vaccinesGiven: [
        {
          vaccine: {
            type: Schema.Types.ObjectId,
            ref: "Vaccine",
          },
          vaccineName: String,
          lastDate: Date,
          nextDue: Date,
          status: {
            type: String,
            enum: ["up_to_date", "due_soon", "overdue", "not_vaccinated"],
            default: "not_vaccinated",
          },
        },
      ],
      lastUpdated: Date,
    },

    // Reproductive Status - SIMPLIFIED
    reproductiveStatus: {
      type: String,
      default: "normal",
    },

    // Feeding & Management - SIMPLIFIED
    feedingType: {
      type: String,
      default: null,
    },
    housingType: {
      type: String,
      default: null,
    },

    // Lifecycle & History - SIMPLIFIED
    dateOfBirth: Date,
    dateOfAcquisition: Date,
    sourceOfAnimal: {
      type: String,
      default: "born_on_farm",
    },
    // REMOVED: purchaseDetails (not needed for bulk registration)

    // Medical History (Summary)
    medicalHistory: [
      {
        date: Date,
        condition: String,
        treatment: String,
        treatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        resolved: {
          type: Boolean,
          default: false,
        },
        notes: String,
      },
    ],

    // REMOVED: breedingHistory (can be added later if needed)

    // Status & Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "sold",
        "deceased",
        "transferred",
        "missing",
      ],
      default: "active",
    },
    statusChangeDate: Date,
    statusChangeReason: String,

    // Additional Information
    additionalNotes: {
      type: String,
      trim: true,
    },

    // Ownership - SIMPLIFIED
    currentOwner: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
    },
    // REMOVED: previousOwners array (not needed for bulk registration)

    // REMOVED: Geo-tagging (not needed for bulk registration)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ================ VIRTUALS ================

// Virtual for age in months
animalSchema.virtual("ageInMonths").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months += today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  return months;
});

// Virtual for pregnancy duration
animalSchema.virtual("pregnancyDurationInDays").get(function () {
  if (
    !this.pregnancyStatus.confirmedDate ||
    !this.pregnancyStatus.expectedDeliveryDate
  ) {
    return null;
  }
  const confirmed = new Date(this.pregnancyStatus.confirmedDate);
  const expected = new Date(this.pregnancyStatus.expectedDeliveryDate);
  return Math.ceil((expected - confirmed) / (1000 * 60 * 60 * 24));
});

// Virtual for vaccination records
animalSchema.virtual("vaccinations", {
  ref: "Vaccination",
  localField: "_id",
  foreignField: "animal",
});

// Virtual for upcoming vaccinations
animalSchema.virtual("upcomingVaccinations", {
  ref: "Vaccination",
  localField: "_id",
  foreignField: "animal",
  match: {
    nextDueDate: { $gte: new Date() },
    status: "Administered",
  },
});

// ================ MIDDLEWARE ================

// Pre-save middleware to generate uniqueAnimalId
animalSchema.pre("save", async function (next) {
  if (!this.uniqueAnimalId) {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");

      // Keep incrementing sequence until we find a unique ID
      let sequence = 1;
      let uniqueId = `ANI-${year}${month}-${String(sequence).padStart(4, "0")}`;
      let exists = await mongoose
        .model("Animal")
        .findOne({ uniqueAnimalId: uniqueId });

      while (exists) {
        sequence++;
        uniqueId = `ANI-${year}${month}-${String(sequence).padStart(4, "0")}`;
        exists = await mongoose
          .model("Animal")
          .findOne({ uniqueAnimalId: uniqueId });
      }

      this.uniqueAnimalId = uniqueId;
    } catch (error) {
      return next(error);
    }
  }

  // Auto-calculate age if dateOfBirth is provided
  if (this.dateOfBirth && !this.age.value) {
    const birthDate = new Date(this.dateOfBirth);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years > 0) {
      this.age = { value: years, unit: "Years" };
    } else if (months > 0) {
      this.age = { value: months, unit: "Months" };
    } else {
      const days = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
      this.age = { value: days, unit: "Days" };
    }
  }

  // Set current owner if not set
  if (!this.currentOwner) {
    this.currentOwner = this.farmer;
  }

  // Update status change date
  if (this.isModified("status")) {
    this.statusChangeDate = new Date();
  }

  // Update vaccination summary timestamp
  if (this.isModified("vaccinationSummary")) {
    this.vaccinationSummary.lastUpdated = new Date();
  }

  next();
});

// ================ INSTANCE METHODS ================

/**
 * Update vaccination summary with latest data
 */
animalSchema.methods.updateVaccinationSummary = async function () {
  try {
    const Vaccination = mongoose.model("Vaccination");

    // Get all vaccinations for this animal
    const vaccinations = await Vaccination.find({
      animal: this._id,
      status: "Administered",
    }).sort({ dateAdministered: -1 });

    if (vaccinations.length > 0) {
      // Latest vaccination
      const latest = vaccinations[0];

      // Get all upcoming due dates
      const upcomingVaccinations = vaccinations.filter((v) => v.nextDueDate);

      // Find earliest next due date
      let earliestNextDue = null;
      if (upcomingVaccinations.length > 0) {
        earliestNextDue = upcomingVaccinations.reduce((earliest, v) => {
          return v.nextDueDate < earliest ? v.nextDueDate : earliest;
        }, upcomingVaccinations[0].nextDueDate);
      }

      // Update summary
      this.vaccinationSummary = {
        lastVaccinationDate: latest.dateAdministered,
        nextVaccinationDate: earliestNextDue,
        lastVaccineType: latest.vaccineType,
        totalVaccinations: vaccinations.length,
        isUpToDate: earliestNextDue ? earliestNextDue > new Date() : false,
        vaccinesGiven: this.vaccinationSummary?.vaccinesGiven || [],
        lastUpdated: new Date(),
      };

      // Update individual vaccine status
      const vaccineMap = new Map();
      vaccinations.forEach((vaccination) => {
        if (vaccination.vaccine) {
          const key = vaccination.vaccine.toString();
          const existing = vaccineMap.get(key);

          if (!existing || existing.lastDate < vaccination.dateAdministered) {
            let status = "not_vaccinated";
            if (vaccination.nextDueDate) {
              const today = new Date();
              const thirtyDaysFromNow = new Date();
              thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

              if (vaccination.nextDueDate < today) {
                status = "overdue";
              } else if (vaccination.nextDueDate <= thirtyDaysFromNow) {
                status = "due_soon";
              } else {
                status = "up_to_date";
              }
            }

            vaccineMap.set(key, {
              vaccine: vaccination.vaccine,
              vaccineName: vaccination.vaccineName,
              lastDate: vaccination.dateAdministered,
              nextDue: vaccination.nextDueDate,
              status: status,
            });
          }
        }
      });

      this.vaccinationSummary.vaccinesGiven = Array.from(vaccineMap.values());
    } else {
      // No vaccinations
      this.vaccinationSummary = {
        totalVaccinations: 0,
        lastVaccinationDate: null,
        nextVaccinationDate: null,
        lastVaccineType: null,
        isUpToDate: false,
        vaccinesGiven: [],
        lastUpdated: new Date(),
      };
    }

    return this.save();
  } catch (error) {
    console.error("Error updating vaccination summary:", error);
    throw error;
  }
};

/**
 * Update health status
 */
animalSchema.methods.updateHealthStatus = function (newStatus, notes) {
  this.healthStatus.currentStatus = newStatus;
  this.healthStatus.lastCheckupDate = new Date();
  if (notes) {
    this.healthStatus.healthNotes = notes;
  }
  return this.save();
};

/**
 * Add medical record
 */
animalSchema.methods.addMedicalRecord = function (record) {
  this.medicalHistory.push({
    date: new Date(),
    ...record,
  });
  return this.save();
};

/**
 * Mark animal as deceased
 */
animalSchema.methods.markAsDeceased = function (reason, date) {
  this.status = "deceased";
  this.isActive = false;
  this.statusChangeDate = date || new Date();
  this.statusChangeReason = reason || "Unknown";
  return this.save();
};

/**
 * Transfer animal to new farmer
 */
animalSchema.methods.transferToFarmer = async function (newFarmerId, reason) {
  const oldFarmerId = this.farmer;

  // Update owner
  this.farmer = newFarmerId;
  this.currentOwner = newFarmerId;
  this.status = "transferred";
  this.statusChangeDate = new Date();
  this.statusChangeReason = reason || "Ownership transfer";

  await this.save();

  // Update counts for both farmers
  const Farmer = mongoose.model("Farmer");
  await Farmer.findByIdAndUpdate(oldFarmerId, {
    $inc: { "farmDetails.activeAnimals": -1 },
  });
  await Farmer.findByIdAndUpdate(newFarmerId, {
    $inc: { "farmDetails.activeAnimals": 1 },
  });

  return this;
};

// ================ STATIC METHODS ================

/**
 * Find animals by farmer
 */
animalSchema.statics.findByFarmer = function (farmerId) {
  return this.find({ farmer: farmerId }).sort({ createdAt: -1 });
};

/**
 * Find pregnant animals
 */
animalSchema.statics.findPregnant = function () {
  return this.find({ "pregnancyStatus.isPregnant": true });
};

/**
 * Find animals with upcoming vaccinations
 */
animalSchema.statics.findUpcomingVaccinations = function (daysThreshold = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    "vaccinationSummary.nextVaccinationDate": {
      $lte: thresholdDate,
      $gte: new Date(),
    },
    isActive: true,
  }).sort({ "vaccinationSummary.nextVaccinationDate": 1 });
};

/**
 * Find animals with overdue vaccinations
 */
animalSchema.statics.findOverdueVaccinations = function () {
  return this.find({
    "vaccinationSummary.nextVaccinationDate": { $lt: new Date() },
    "vaccinationSummary.isUpToDate": false,
    isActive: true,
  }).sort({ "vaccinationSummary.nextVaccinationDate": 1 });
};

/**
 * Find animals by bulk registration batch
 */
animalSchema.statics.findByBatchId = function (batchId) {
  return this.find({ registrationBatchId: batchId })
    .populate("farmer", "name uniqueFarmerId")
    .populate("registeredBy", "name")
    .sort({ registrationBatchIndex: 1 });
};

/**
 * Get registration statistics for today
 */
animalSchema.statics.getTodayStats = async function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: today },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        byType: { $push: "$animalType" },
        pregnant: {
          $sum: { $cond: ["$pregnancyStatus.isPregnant", 1, 0] },
        },
        batches: { $addToSet: "$registrationBatchId" },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        pregnant: 1,
        batchCount: { $size: "$batches" },
        typeCounts: {
          $reduce: {
            input: "$byType",
            initialValue: {},
            in: {
              $mergeObjects: [
                "$$value",
                {
                  [String("$$this")]: {
                    $add: [
                      {
                        $ifNull: [
                          {
                            $arrayElemAt: [
                              { $objectToArray: "$$value" },
                              {
                                $indexOfArray: [
                                  {
                                    $map: {
                                      input: { $objectToArray: "$$value" },
                                      as: "item",
                                      in: "$$item.k",
                                    },
                                  },
                                  "$$this",
                                ],
                              },
                            ],
                          },
                          0,
                        ],
                      },
                      1,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);

  return stats[0] || { total: 0, pregnant: 0, batchCount: 0, typeCounts: {} };
};

// ================ INDEXES ================

// Optimized indexes for common queries
animalSchema.index({ farmer: 1, isActive: 1, createdAt: -1 });
animalSchema.index({ tagNumber: 1 }, { unique: true, sparse: true });
animalSchema.index({ uniqueAnimalId: 1 }, { unique: true });
animalSchema.index({ animalType: 1, gender: 1 });
animalSchema.index({ "healthStatus.currentStatus": 1, isActive: 1 });
animalSchema.index({ "pregnancyStatus.isPregnant": 1, isActive: 1 });
animalSchema.index({
  "vaccinationSummary.nextVaccinationDate": 1,
  isActive: 1,
});
animalSchema.index({ "vaccinationSummary.isUpToDate": 1, isActive: 1 });
animalSchema.index({ status: 1, isActive: 1 });
animalSchema.index({ createdAt: -1 });
animalSchema.index({ registrationBatchId: 1 }); // NEW: For bulk registration

module.exports = mongoose.model("Animal", animalSchema);

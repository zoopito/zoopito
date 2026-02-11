const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const vaccinationSchema = new Schema(
  {
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
      index: true,
    },
    animal: {
      type: Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
      index: true,
    },
    vaccine: {
      type: Schema.Types.ObjectId,
      ref: "Vaccine",
      required: true,
    },

    // REMOVED: vaccineScheduleRule - not needed for bulk registration

    // Simplified fields for bulk registration
    vaccineName: {
      type: String,
      required: true,
      trim: true,
    },
    vaccineType: {
      type: String,
      required: true,
    },

    // Batch/Lot information
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },

    // Dose information - simplified
    doseNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    totalDosesRequired: {
      type: Number,
      min: 1,
      default: 1,
    },

    // Administration details - simplified
    administrationMethod: {
      type: String,
      enum: ["Injection", "Oral", "Nasal", "Topical", "Other"],
      default: "Injection",
    },
    injectionSite: {
      type: String,
      enum: [
        "Subcutaneous",
        "Intramuscular",
        "Intradermal",
        "Intravenous",
        "Not Applicable",
      ],
      default: "Subcutaneous",
    },
    dosageAmount: Number,
    dosageUnit: {
      type: String,
      enum: ["ml", "cc", "mg", "IU", "drops", "tablets", "Other"],
      default: "ml",
    },

    // Timing - simplified
    dateAdministered: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextDueDate: {
      type: Date,
    },

    // Personnel - simplified (String for bulk registration)
    administeredBy: {
      type: String, // Changed from ObjectId to String for bulk registration
      required: true,
      trim: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Animal condition at time of vaccination (optional)
    animalCondition: {
      temperature: Number,
      weight: Number,
      bodyConditionScore: {
        type: Number,
        min: 1,
        max: 5,
      },
      isPregnant: Boolean,
      isLactating: Boolean,
      healthNotes: String,
    },

    // Safety & Reactions
    hadAdverseReaction: {
      type: Boolean,
      default: false,
    },
    adverseReactionDetails: String,
    reactionSeverity: {
      type: String,
      enum: ["Mild", "Moderate", "Severe"],
    },

    // Documentation
    notes: {
      type: String,
      maxLength: 1000,
      trim: true,
    },
    followUpInstructions: String,

    // Status & Workflow
    status: {
      type: String,
      enum: [
        "Scheduled",
        "Administered",
        "Completed",
        "Missed",
        "Cancelled",
        "Adverse Reaction",
      ],
      default: "Administered",
    },
    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    verificationNotes: String,

    // NEW: Bulk registration tracking
    source: {
      type: String,
      enum: ["bulk_registration", "manual_entry", "schedule", "import"],
      default: "manual_entry",
      index: true,
    },
    registrationBatchId: {
      type: String,
      index: true,
      description: "Group ID for bulk registration",
    },
    registrationBatchIndex: {
      type: Number,
      description: "Index within the bulk registration batch",
    },

    // Audit trail
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Series completion
    isSeriesComplete: {
      type: Boolean,
      default: false,
    },
    seriesCompletionDate: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ================ VIRTUALS ================

// Virtual for checking if vaccination is overdue
vaccinationSchema.virtual("isOverdue").get(function () {
  if (!this.nextDueDate || this.status !== "Administered") return false;
  return this.nextDueDate < new Date();
});

// Virtual for days until/since due
vaccinationSchema.virtual("daysUntilDue").get(function () {
  if (!this.nextDueDate) return null;
  const diff = this.nextDueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for vaccination age in days
vaccinationSchema.virtual("daysSinceAdministered").get(function () {
  const diff = new Date() - this.dateAdministered;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// ================ MIDDLEWARE ================

// Pre-save middleware to calculate nextDueDate if not provided
vaccinationSchema.pre("save", async function (next) {
  // Calculate nextDueDate if not provided
  if (!this.nextDueDate) {
    try {
      const Vaccine = mongoose.model("Vaccine");
      const vaccine = await Vaccine.findById(this.vaccine);

      if (vaccine && vaccine.defaultNextDueMonths) {
        const nextDue = new Date(this.dateAdministered);
        nextDue.setMonth(nextDue.getMonth() + vaccine.defaultNextDueMonths);
        this.nextDueDate = nextDue;
      } else if (vaccine && vaccine.boosterIntervalWeeks) {
        const nextDue = new Date(this.dateAdministered);
        nextDue.setDate(nextDue.getDate() + vaccine.boosterIntervalWeeks * 7);
        this.nextDueDate = nextDue;
      } else {
        // Default: 1 year
        const nextDue = new Date(this.dateAdministered);
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        this.nextDueDate = nextDue;
      }
    } catch (error) {
      // Default to 1 year if vaccine not found
      const nextDue = new Date(this.dateAdministered);
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      this.nextDueDate = nextDue;
    }
  }

  // Mark series as complete
  if (this.doseNumber === this.totalDosesRequired && !this.isSeriesComplete) {
    this.isSeriesComplete = true;
    this.seriesCompletionDate = new Date();
  }

  next();
});

// ================ STATIC METHODS ================

// Find vaccinations by registration batch
vaccinationSchema.statics.findByRegistrationBatch = function (batchId) {
  return this.find({ registrationBatchId: batchId })
    .populate("animal", "tagNumber name uniqueAnimalId")
    .populate("farmer", "name uniqueFarmerId")
    .populate("vaccine", "name vaccineType")
    .sort({ dateAdministered: -1 });
};

// Create bulk vaccinations
vaccinationSchema.statics.createBulkVaccinations = async function (
  vaccinationsData,
  userId,
) {
  const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const vaccinations = vaccinationsData.map((data, index) => ({
    ...data,
    source: "bulk_registration",
    registrationBatchId: batchId,
    registrationBatchIndex: index,
    createdBy: userId,
    status: "Administered",
  }));

  return this.insertMany(vaccinations);
};

// Find upcoming due vaccinations
vaccinationSchema.statics.findUpcomingDue = function (daysThreshold = 7) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    nextDueDate: {
      $lte: thresholdDate,
      $gte: new Date(),
    },
    status: "Administered",
    isSeriesComplete: false,
  })
    .populate("animal", "tagNumber name")
    .populate("farmer", "name")
    .populate("vaccine", "name")
    .sort({ nextDueDate: 1 });
};

// Find overdue vaccinations
vaccinationSchema.statics.findOverdue = function () {
  return this.find({
    nextDueDate: { $lt: new Date() },
    status: "Administered",
    isSeriesComplete: false,
  })
    .populate("animal", "tagNumber name")
    .populate("farmer", "name")
    .populate("vaccine", "name")
    .sort({ nextDueDate: 1 });
};

// Get vaccination statistics for a farmer
vaccinationSchema.statics.getFarmerStats = async function (farmerId) {
  const stats = await this.aggregate([
    { $match: { farmer: mongoose.Types.ObjectId(farmerId) } },
    {
      $group: {
        _id: null,
        totalVaccinations: { $sum: 1 },
        uniqueAnimals: { $addToSet: "$animal" },
        overdueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$nextDueDate", new Date()] },
                  { $eq: ["$status", "Administered"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        upcomingCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$nextDueDate", new Date()] },
                  {
                    $lte: [
                      "$nextDueDate",
                      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        totalVaccinations: 1,
        uniqueAnimalCount: { $size: "$uniqueAnimals" },
        overdueCount: 1,
        upcomingCount: 1,
      },
    },
  ]);

  return (
    stats[0] || {
      totalVaccinations: 0,
      uniqueAnimalCount: 0,
      overdueCount: 0,
      upcomingCount: 0,
    }
  );
};

// ================ INSTANCE METHODS ================

// Method to mark as missed
vaccinationSchema.methods.markAsMissed = function (reason) {
  this.status = "Missed";
  this.notes = this.notes
    ? `${this.notes}\nMissed: ${reason}`
    : `Missed: ${reason}`;
  return this.save();
};

// Method to mark as administered
vaccinationSchema.methods.markAsAdministered = function (data) {
  this.status = "Administered";
  this.dateAdministered = data.dateAdministered || new Date();
  this.administeredBy = data.administeredBy || this.administeredBy;
  this.batchNumber = data.batchNumber || this.batchNumber;
  this.notes = data.notes || this.notes;
  return this.save();
};

// Method to reschedule
vaccinationSchema.methods.reschedule = function (newDueDate, reason) {
  this.nextDueDate = new Date(newDueDate);
  this.status = "Scheduled";
  this.notes = this.notes
    ? `${this.notes}\nRescheduled: ${reason}`
    : `Rescheduled: ${reason}`;
  return this.save();
};

// ================ INDEXES ================

// Compound indexes for efficient queries
vaccinationSchema.index({ farmer: 1, nextDueDate: 1, status: 1 });
vaccinationSchema.index({ animal: 1, dateAdministered: -1 });
vaccinationSchema.index({ vaccine: 1, dateAdministered: -1 });
vaccinationSchema.index({ administeredBy: 1, dateAdministered: -1 });
vaccinationSchema.index({ registrationBatchId: 1 });
vaccinationSchema.index({ source: 1, createdAt: -1 });
vaccinationSchema.index({ status: 1, nextDueDate: 1 });
vaccinationSchema.index({ batchNumber: 1, vaccine: 1 });

// Text index for search
vaccinationSchema.index({
  notes: "text",
  batchNumber: "text",
  adverseReactionDetails: "text",
  vaccineName: "text",
});

module.exports = mongoose.model("Vaccination", vaccinationSchema);

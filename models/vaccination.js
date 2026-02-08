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
    vaccineScheduleRule: {
      type: Schema.Types.ObjectId,
      ref: "VaccineScheduleRule",
      description: "Which schedule rule was applied for timing/eligibility",
    },

    // Batch/Lot information for tracking
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value > new Date();
        },
        message: "Vaccine has expired",
      },
    },

    // Dose information
    doseNumber: {
      type: Number,
      min: 1,
      required: true,
      default: 1,
    },
    totalDosesRequired: {
      type: Number,
      min: 1,
      required: true,
      default: 1,
    },

    // Administration details
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
    dosageAmount: {
      type: Number,
      min: 0,
    },
    dosageUnit: {
      type: String,
      enum: ["ml", "cc", "mg", "IU", "drops", "tablets", "Other"],
      default: "ml",
    },

    // Timing
    dateAdministered: {
      type: Date,
      required: true,
      default: Date.now,
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: "Administration date cannot be in the future",
      },
    },
    nextDueDate: {
      type: Date,
      required: function () {
        return (
          this.doseNumber < this.totalDosesRequired ||
          this.vaccineScheduleRule?.repeatIntervalMonths
        );
      },
    },

    // Personnel
    administeredBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Changed to generic User model (can be Paravet, Vet, etc.)
      required: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Animal condition at time of vaccination
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
    adverseReactionDetails: {
      type: String,
      required: function () {
        return this.hadAdverseReaction;
      },
    },
    reactionSeverity: {
      type: String,
      enum: ["Mild", "Moderate", "Severe"],
    },

    // Documentation
    notes: {
      type: String,
      maxLength: 1000,
    },
    followUpInstructions: String,

    // Multimedia
    photos: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: String,
        caption: String,
        takenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    documents: [
      {
        name: String,
        url: String,
        type: String,
      },
    ],

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

    // For tracking series completion
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

// Virtual for checking if vaccination is overdue
vaccinationSchema.virtual("isOverdue").get(function () {
  if (!this.nextDueDate || this.status !== "Completed") return false;
  return this.nextDueDate < new Date();
});

// Virtual for days until/since due
vaccinationSchema.virtual("daysUntilDue").get(function () {
  if (!this.nextDueDate) return null;
  const diff = this.nextDueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate nextDueDate if not provided
vaccinationSchema.pre("save", async function (next) {
  // If nextDueDate not provided but we have schedule rule, calculate it
  if (!this.nextDueDate && this.vaccineScheduleRule) {
    try {
      const VaccineScheduleRule = mongoose.model("VaccineScheduleRule");
      const rule = await VaccineScheduleRule.findById(this.vaccineScheduleRule);

      if (rule && rule.repeatIntervalMonths) {
        const nextDue = new Date(this.dateAdministered);
        nextDue.setMonth(nextDue.getMonth() + rule.repeatIntervalMonths);
        this.nextDueDate = nextDue;
      }
    } catch (error) {
      // If rule not found, continue without setting nextDueDate
    }
  }

  // Mark series as complete
  if (this.doseNumber === this.totalDosesRequired && !this.isSeriesComplete) {
    this.isSeriesComplete = true;
    this.seriesCompletionDate = new Date();
  }

  next();
});

// Static method to find upcoming due vaccinations
vaccinationSchema.statics.findUpcomingDue = function (daysThreshold = 7) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    nextDueDate: {
      $lte: thresholdDate,
      $gte: new Date(),
    },
    status: "Completed",
    isSeriesComplete: false,
  }).populate("animal farmer vaccine");
};

// Static method to find overdue vaccinations
vaccinationSchema.statics.findOverdue = function () {
  return this.find({
    nextDueDate: { $lt: new Date() },
    status: "Completed",
    isSeriesComplete: false,
  }).populate("animal farmer vaccine");
};

// Method to mark as missed
vaccinationSchema.methods.markAsMissed = function (reason) {
  this.status = "Missed";
  this.notes = this.notes
    ? `${this.notes}\nMissed: ${reason}`
    : `Missed: ${reason}`;
  return this.save();
};

// Compound indexes for efficient queries
vaccinationSchema.index({ farmer: 1, nextDueDate: 1, status: 1 });
vaccinationSchema.index({ animal: 1, vaccine: 1, doseNumber: 1 });
vaccinationSchema.index({ administeredBy: 1, dateAdministered: -1 });
vaccinationSchema.index({ status: 1, nextDueDate: 1 });
vaccinationSchema.index({ batchNumber: 1, vaccine: 1 });
vaccinationSchema.index({
  "animalCondition.isPregnant": 1,
  "animalCondition.isLactating": 1,
});

// Text index for search
vaccinationSchema.index({
  notes: "text",
  batchNumber: "text",
  adverseReactionDetails: "text",
});

module.exports = mongoose.model("Vaccination", vaccinationSchema);

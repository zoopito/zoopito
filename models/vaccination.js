// models/vaccination.js
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
    dosageAmount: Number,
    dosageUnit: {
      type: String,
      enum: ["ml", "cc", "mg", "IU", "drops", "drop", "tablets", "Other"],
      default: "ml",
    },

    // Timing
    dateAdministered: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextDueDate: {
      type: Date,
    },

    // Personnel
    administeredBy: {
      type: String,
      required: true,
      trim: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Animal condition
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

    // Payment Information - NEW
    payment: {
      vaccinePrice: {
        type: Number,
        required: true,
        min: 0,
      },
      serviceCharge: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      paymentStatus: {
        type: String,
        enum: ["Pending", "Completed", "Failed", "Refunded", "Verified"],
        default: "Pending",
      },
      paymentMethod: {
        type: String,
        enum: ["UPI", "Cash", "Bank Transfer", "Card", "Other"],
        default: "UPI",
      },
      paymentDate: Date,
      utrNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
      paymentVerifiedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      paymentVerifiedAt: Date,
      paymentNotes: String,
      receiptNumber: {
        type: String,
        unique: true,
        sparse: true,
      },
    },

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
        "Payment Pending", // NEW
        "Payment Verified", // NEW
      ],
      default: "Payment Pending",
    },
    scheduledDate: {
      type: Date,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    verificationNotes: String,

    // Bulk registration tracking
    source: {
      type: String,
      enum: ["bulk_registration", "manual_entry", "schedule", "import"],
      default: "manual_entry",
      index: true,
    },
    registrationBatchId: {
      type: String,
      index: true,
    },
    registrationBatchIndex: {
      type: Number,
    },
    isBulkRegistration: {
      type: Boolean,
      default: false,
    },
    bulkAnimalCount: {
      type: Number,
      min: 1,
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

// Virtual for formatted receipt number
vaccinationSchema.virtual("formattedReceiptNumber").get(function () {
  if (this.payment?.receiptNumber) {
    return this.payment.receiptNumber;
  }
  return `RCP-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Pre-save middleware to generate receipt number
vaccinationSchema.pre("save", async function (next) {
  // Generate receipt number if payment is completed
  if (
    this.payment?.paymentStatus === "Completed" &&
    !this.payment.receiptNumber
  ) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const count = await mongoose.model("Vaccination").countDocuments({
      "payment.paymentStatus": "Completed",
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
    });
    const serial = (count + 1).toString().padStart(4, "0");
    this.payment.receiptNumber = `RCP-${year}${month}-${serial}`;
  }

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
        const nextDue = new Date(this.dateAdministered);
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        this.nextDueDate = nextDue;
      }
    } catch (error) {
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

// Static methods
vaccinationSchema.statics.findByPaymentStatus = function (status) {
  return this.find({ "payment.paymentStatus": status })
    .populate("farmer", "name phone village")
    .populate("animal", "name tagId species")
    .populate("vaccine", "name brand")
    .sort({ createdAt: -1 });
};

vaccinationSchema.statics.verifyPayment = async function (
  vaccinationId,
  userId,
) {
  const vaccination = await this.findById(vaccinationId);
  if (!vaccination) throw new Error("Vaccination not found");

  vaccination.payment.paymentStatus = "Verified";
  vaccination.payment.paymentVerifiedBy = userId;
  vaccination.payment.paymentVerifiedAt = new Date();
  vaccination.status = "Administered";
  vaccination.verificationStatus = "Verified";

  return vaccination.save();
};

// Indexes
vaccinationSchema.index({ "payment.paymentStatus": 1, createdAt: -1 });
vaccinationSchema.index({ "payment.utrNumber": 1 });
vaccinationSchema.index({ "payment.receiptNumber": 1 });
vaccinationSchema.index({ status: 1, "payment.paymentStatus": 1 });

module.exports = mongoose.model("Vaccination", vaccinationSchema);

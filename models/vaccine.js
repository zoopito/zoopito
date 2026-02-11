const mongoose = require("mongoose");

const vaccineSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    vaccineName: {
      // Alias for compatibility
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
    },
    manufacturer: String,

    // Classification
    vaccineType: {
      type: String,
      enum: [
        "Live Attenuated",
        "Inactivated",
        "Toxoid",
        "Subunit",
        "Conjugate",
        "mRNA",
        "Other",
      ],
      required: true,
    },
    diseaseTarget: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["Core", "Non-Core", "Optional", "Seasonal", "Emergency"],
      default: "Core",
    },
    targetSpecies: [
      {
        type: String,
        enum: [
          "Cattle",
          "Sheep",
          "Goat",
          "Pig",
          "Chicken",
          "Dog",
          "Cat",
          "Horse",
          "All",
          "Cow", // Added for compatibility
          "Buffalo", // Added for compatibility
          "Poultry", // Added for compatibility
        ],
      },
    ],

    // NEW: Bulk registration support fields
    defaultNextDueMonths: {
      type: Number,
      default: 12,
      min: 1,
      max: 60,
      description: "Default months until next dose for bulk registration",
    },
    requiresBatchNumber: {
      type: Boolean,
      default: false,
      description: "Whether batch number is required for this vaccine",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      description: "Short description for display in forms",
    },

    // Administration Details
    administrationRoute: {
      type: String,
      enum: [
        "Subcutaneous",
        "Intramuscular",
        "Oral",
        "Nasal",
        "Ocular",
        "Intradermal",
        "Topical",
      ],
      required: true,
    },
    dosageUnit: {
      type: String,
      enum: ["ml", "dose", "tablet", "drop", "spray"],
      default: "ml",
    },
    standardDosage: Number,

    // Safety & Storage
    contraindications: String,
    sideEffects: String,
    storageTemperature: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        default: "°C",
      },
    },
    shelfLifeMonths: Number,
    requiresRefrigeration: {
      type: Boolean,
      default: true,
    },

    // Timing Information
    minimumAgeWeeks: Number,
    boosterIntervalWeeks: Number,
    immunityDurationMonths: Number,

    // Regulatory
    licenseNumber: String,
    approvedSpecies: [String],
    withdrawalPeriodDays: Number,

    // Status & Meta
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Pre-save middleware to set vaccineName
vaccineSchema.pre("save", function (next) {
  if (!this.vaccineName) {
    this.vaccineName = this.name;
  }
  next();
});

// Virtual for display name
vaccineSchema.virtual("displayName").get(function () {
  return `${this.name} (${this.vaccineType})`;
});

// Indexes
vaccineSchema.index({ name: 1, brand: 1 });
vaccineSchema.index({ targetSpecies: 1, isActive: 1 });
vaccineSchema.index({
  diseaseTarget: "text",
  name: "text",
  description: "text",
});
vaccineSchema.index({ vaccineType: 1 });
vaccineSchema.index({ defaultNextDueMonths: 1 }); // For bulk registration

module.exports = mongoose.model("Vaccine", vaccineSchema);

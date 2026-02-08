// models/Vaccine.js
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
        ],
      },
    ],

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

    // Timing Information (Default values - can be overridden by VaccineScheduleRule)
    minimumAgeWeeks: Number, // Minimum age for first dose
    boosterIntervalWeeks: Number, // Default booster interval
    immunityDurationMonths: Number, // How long immunity lasts

    // Regulatory
    licenseNumber: String,
    approvedSpecies: [String],
    withdrawalPeriodDays: Number, // Important for milk/meat

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
  { timestamps: true },
);

// Indexes
vaccineSchema.index({ name: 1, brand: 1 });
vaccineSchema.index({ targetSpecies: 1, isActive: 1 });
vaccineSchema.index({ diseaseTarget: "text", name: "text" });

module.exports = mongoose.model("Vaccine", vaccineSchema);

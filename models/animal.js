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
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    uniqueAnimalId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
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

    // Pregnancy Status
    pregnancyStatus: {
      isPregnant: {
        type: Boolean,
        default: false,
      },
      kitUsed: {
        type: String,
        enum: [
          "ultrasound",
          "blood_test",
          "palpation",
          "urine_test",
          "milk_test",
          "other",
          null,
        ],
      },
      testDate: Date,
      confirmedDate: Date,
      expectedDeliveryDate: Date,
      stage: {
        type: String,
        enum: ["early", "mid", "late", "full_term", null],
      },
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

    // Lactation Status
    lactationStatus: {
      isLactating: {
        type: Boolean,
        default: false,
      },
      lastCalvingDate: Date,
      lactationNumber: {
        type: Number,
        min: 1,
      },
      daysInMilk: {
        type: Number,
        min: 0,
      },
      dailyYield: {
        value: {
          type: Number,
          min: 0,
        },
        unit: {
          type: String,
          enum: ["liters", "kg", "ml", "gallons", null],
        },
      },
      milkQuality: {
        type: String,
        enum: ["excellent", "good", "average", "poor", "not_tested", null],
      },
      milkingFrequency: {
        type: String,
        enum: ["1", "2", "3", "4", "machine", null],
      },
      lactationNotes: {
        type: String,
        trim: true,
      },
    },

    // Health Status
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
      nextCheckupDate: Date,
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
      weight: {
        value: Number,
        unit: {
          type: String,
          enum: ["kg", "pounds", null],
          default: "kg",
        },
        lastUpdated: Date,
      },
    },

    // Vaccination Summary (Reference to detailed vaccination records)
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
    },

    // Reproductive Status
    reproductiveStatus: {
      type: String,
      enum: [
        "normal",
        "in_heat",
        "bred",
        "open",
        "sterile",
        "castrated",
        "not_applicable",
      ],
      default: "normal",
    },

    // Feeding & Management
    feedingType: {
      type: String,
      enum: [
        "grazing",
        "stall_feeding",
        "mixed",
        "concentrate",
        "organic",
        null,
      ],
    },
    housingType: {
      type: String,
      enum: [
        "free_stall",
        "tie_stall",
        "pasture",
        "shelter",
        "open_yard",
        "other",
        null,
      ],
    },

    // Lifecycle & History
    dateOfBirth: Date,
    dateOfAcquisition: Date,
    sourceOfAnimal: {
      type: String,
      enum: ["born_on_farm", "purchased", "gifted", "other"],
    },
    purchaseDetails: {
      price: Number,
      currency: {
        type: String,
        default: "INR",
      },
      seller: String,
      purchaseDate: Date,
    },

    // Medical History (Summary)
    medicalHistory: [
      {
        date: Date,
        condition: String,
        treatment: String,
        treatedBy: {
          type: Schema.Types.ObjectId,
          ref: "Paravet",
        },
        resolved: {
          type: Boolean,
          default: false,
        },
        notes: String,
      },
    ],

    // Breeding History
    breedingHistory: [
      {
        matingDate: Date,
        bullId: String,
        bullBreed: String,
        pregnancyConfirmed: Boolean,
        confirmedDate: Date,
        calvingDate: Date,
        offspringCount: Number,
        offspringGender: [String],
        notes: String,
      },
    ],

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

    // Ownership & Audit Trail
    currentOwner: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
    },
    previousOwners: [
      {
        farmer: {
          type: Schema.Types.ObjectId,
          ref: "Farmer",
        },
        fromDate: Date,
        toDate: Date,
        transferReason: String,
      },
    ],

    // Geo-tagging
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
      address: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for age in months
animalSchema.virtual("ageInMonths").get(function () {
  if (!this.dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months += today.getMonth() - birthDate.getMonth();

  // Adjust if day of month hasn't been reached
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
  const diffTime = Math.abs(expected - confirmed);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
});

// Virtual for days since last calving
animalSchema.virtual("daysSinceLastCalving").get(function () {
  if (!this.lactationStatus.lastCalvingDate) return null;

  const lastCalving = new Date(this.lactationStatus.lastCalvingDate);
  const today = new Date();
  const diffTime = Math.abs(today - lastCalving);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
});

// Virtual for vaccination status
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
    status: { $ne: "Completed" },
  },
});

// Pre-save middleware to generate uniqueAnimalId
animalSchema.pre("save", async function (next) {
  if (!this.uniqueAnimalId) {
    try {
      // Generate unique ID: ANI-YYYY-MM-XXXX
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const count = await mongoose.model("Animal").countDocuments({
        createdAt: {
          $gte: new Date(date.getFullYear(), date.getMonth(), 1),
          $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
        },
      });

      const sequence = String(count + 1).padStart(4, "0");
      this.uniqueAnimalId = `ANI-${year}${month}-${sequence}`;
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

  // Update vaccination summary
  if (this.isModified("vaccinationSummary")) {
    this.vaccinationSummary.lastUpdated = new Date();
  }

  next();
});

// Pre-save middleware to update current owner
animalSchema.pre("save", function (next) {
  if (!this.currentOwner) {
    this.currentOwner = this.farmer;
  }

  // If status changed, update statusChangeDate
  if (this.isModified("status")) {
    this.statusChangeDate = new Date();
  }

  next();
});

// Indexes for efficient queries
animalSchema.index({ farmer: 1, tagNumber: 1 });
animalSchema.index({ uniqueAnimalId: 1 });
animalSchema.index({ animalType: 1, gender: 1 });
animalSchema.index({ "healthStatus.currentStatus": 1 });
animalSchema.index({ "pregnancyStatus.isPregnant": 1 });
animalSchema.index({ "lactationStatus.isLactating": 1 });
animalSchema.index({ "vaccinationSummary.nextVaccinationDate": 1 });
animalSchema.index({ status: 1, isActive: 1 });
animalSchema.index({ createdAt: -1 });
animalSchema.index({ "location.coordinates": "2dsphere" });

// Static methods
animalSchema.statics.findByFarmer = function (farmerId) {
  return this.find({ farmer: farmerId }).sort({ createdAt: -1 });
};

animalSchema.statics.findPregnantAnimals = function () {
  return this.find({ "pregnancyStatus.isPregnant": true });
};

animalSchema.statics.findLactatingAnimals = function () {
  return this.find({ "lactationStatus.isLactating": true });
};

animalSchema.statics.findUpcomingVaccinations = function (daysThreshold = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    "vaccinationSummary.nextVaccinationDate": {
      $lte: thresholdDate,
      $gte: new Date(),
    },
  });
};

// Instance methods
animalSchema.methods.updateHealthStatus = function (newStatus, notes) {
  this.healthStatus.currentStatus = newStatus;
  this.healthStatus.lastCheckupDate = new Date();
  if (notes) {
    this.healthStatus.healthNotes = notes;
  }
  return this.save();
};

animalSchema.methods.addMedicalRecord = function (record) {
  this.medicalHistory.push({
    date: new Date(),
    ...record,
  });
  return this.save();
};

animalSchema.methods.addBreedingRecord = function (record) {
  this.breedingHistory.push({
    matingDate: new Date(),
    ...record,
  });
  return this.save();
};

animalSchema.methods.updateVaccinationSummary = async function () {
  const Vaccination = mongoose.model("Vaccination");
  const vaccinations = await Vaccination.find({ animal: this._id })
    .sort({ dateAdministered: -1 })
    .limit(1);

  if (vaccinations.length > 0) {
    const latest = vaccinations[0];
    this.vaccinationSummary = {
      lastVaccinationDate: latest.dateAdministered,
      nextVaccinationDate: latest.nextDueDate,
      lastVaccineType: latest.vaccineName,
      totalVaccinations: await Vaccination.countDocuments({ animal: this._id }),
      isUpToDate: new Date() <= latest.nextDueDate,
    };
  }

  return this.save();
};

module.exports = mongoose.model("Animal", animalSchema);

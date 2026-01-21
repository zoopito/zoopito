const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const animalSchema = new Schema(
  {
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
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
    breed: String,
    age: {
      value: Number,
      unit: {
        type: String,
        enum: ["Days", "Months", "Years"],
      },
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Unknown"],
    },
    name: String,
    tagNumber: String,
    // Photo documentation
    photos: {
      front: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: Date,
      },
      left: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: Date,
      },
      right: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: Date,
      },
      back: {
        url: String,
        filename: String,
        public_id: String,
        uploadedAt: Date,
      },
    },
    lactationStatus: {
      isLactating: Boolean,
      lastCalvingDate: Date,
      dailyYield: Number,
      yieldUnit: String,
    },
    healthStatus: {
      type: String,
      enum: ["Healthy", "Sick", "Under Treatment", "Recovered"],
      default: "Healthy",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    uniqueAnimalId: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Animal", animalSchema);

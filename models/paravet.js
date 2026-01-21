const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paravetSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    qualification: {
      type: String,
      required: true,
    },
    licenseNumber: {
      type: String,
      unique: true,
    },
    assignedAreas: [
      {
        village: String,
        taluka: String,
        district: String,
        state: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    totalFarmersAssigned: {
      type: Number,
      default: 0,
    },
    assignedFarmers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Farmer",
      },
    ],
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service", // vaccination / treatment
      },
    ],
    totalServicesCompleted: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Paravet", paravetSchema);

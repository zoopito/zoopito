const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const salesTeamSchema = new Schema(
  {
    // 🔗 Base user account
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    employeeCode: {
      type: String,
      unique: true,
      required: true,
    },

    // 🔹 Area assignment
    assignedAreas: [
      {
        village: String,
        taluka: String,
        district: String,
        state: String,
      },
    ],

    // 🔹 Data references (NO COUNTERS)
    onboardedFarmers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Farmer",
      },
    ],

    onboardedAnimals: [
      {
        type: Schema.Types.ObjectId,
        ref: "Animal",
      },
    ],

    // 🔹 Activity tracking
    lastActiveAt: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔹 Notes (optional, future use)
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SalesTeam", salesTeamSchema);

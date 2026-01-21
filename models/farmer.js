const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const farmerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      village: String,
      taluka: String,
      district: String,
      state: String,
      pincode: String,
    },
    // GPS Location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    photo: {
      url: String,
      filename: String,
      public_id: String,
    },
    assignedParavet: {
      type: Schema.Types.ObjectId,
      ref: "Paravet",
    },
    totalAnimals: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    uniqueFarmerId: {
      type: String,
      unique: true,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Farmer", farmerSchema);

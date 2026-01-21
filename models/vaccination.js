const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const vaccinationSchema = new Schema(
  {
    farmer: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },
    animal: {
      type: Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
    },
    vaccineName: {
      type: String,
      required: true,
    },
    vaccineType: {
      type: String,
      enum: ["Preventive", "Therapeutic", "Seasonal"],
    },
    dateAdministered: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextDueDate: {
      type: Date,
      required: true,
    },
    administeredBy: {
      type: Schema.Types.ObjectId,
      ref: "Paravet",
      required: true,
    },
    notes: String,
    photos: [
      {
        url: String,
        public_id: String,
      },
    ],
    status: {
      type: String,
      enum: ["Completed", "Pending", "Missed"],
      default: "Completed",
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
vaccinationSchema.index({ farmer: 1, animal: 1, nextDueDate: 1 });
vaccinationSchema.index({ administeredBy: 1, dateAdministered: 1 });

module.exports = mongoose.model("Vaccination", vaccinationSchema);

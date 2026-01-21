const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Notification Details
    type: {
      type: String,
      required: true,
      enum: [
        "vaccination_reminder",
        "service_due",
        "follow_up",
        "system_alert",
        "new_assignment",
        "farmer_registration",
        "animal_registration",
        "payment_due",
        "emergency",
        "government_scheme",
        "market_price",
        "weather_alert",
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },

    // Reference to related entity
    referenceType: {
      type: String,
      enum: [
        "animal",
        "farmer",
        "vaccination",
        "service",
        "assignment",
        "user",
      ],
    },
    referenceId: mongoose.Schema.Types.ObjectId,

    // Delivery & Status
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Delivery Channels
    channels: [
      {
        type: String,
        enum: ["in_app", "email", "sms", "whatsapp", "push"],
        default: ["in_app"],
      },
    ],
    deliveredVia: [String],

    // Timing
    scheduledFor: Date,
    sentAt: Date,
    readAt: Date,

    // Metadata
    data: mongoose.Schema.Types.Mixed, // Additional data in JSON format
    actions: [
      {
        label: String,
        action: String,
        url: String,
      },
    ],

    // Expiry
    expiresAt: Date,
    isPersistent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
notificationSchema.index({ userId: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

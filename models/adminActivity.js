const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminActivitySchema = new Schema({
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    enum: ["create", "edit", "delete", "login", "logout", "settings_change", "status_toggle"],
    required: true
  },
  targetUser: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  description: {
    type: String,
    required: true
  },
  ip: String,
  userAgent: String,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model("AdminActivity", adminActivitySchema);
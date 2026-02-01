const mongoose = require("mongoose");
const passportLocalMongoose =
  require("passport-local-mongoose").default ||
  require("passport-local-mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    mobile: {
      type: String,
      unique: true,
      sparse: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "SALES", "PARAVET", "FARMER", "USER"],
      default: "USER",
      // required: true,
    },
    assignedArea: {
      village: { type: String },
      taluka: { type: String },
      district: { type: String },
      state: { type: String },
    },
    designation: {
      type: String, // Field Executive / Veterinary Doctor / Paravet
    },
    qualification: {
      type: String, // useful for Paravet / Vet
    },
    registrationNumber: {
      type: String, // Vet registration (future trust + govt use)
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,

    otp: String,
    otpExpires: Date,

    resetPasswordToken: String,
    resetPasswordExpires: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Admin who created this user
    },
    lastLogin: {
      type: Date,
    },
    loginHistory: [
      {
        ip: String,
        userAgent: String,
        loggedInAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);
// Passport-local plugin
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
  limitAttempts: true,
  maxAttempts: 3,
  interval: 100,
  maxInterval: 300000,
  unlockInterval: 60000,
  errorMessages: {
    MissingPasswordError: "No password was given",
    AttemptTooSoonError: "Account is currently locked. Try again later",
    TooManyAttemptsError:
      "Too many unsuccessful login attempts. Please try again in 5 minutes.",
    NoSaltValueStoredError: "Authentication failed. No salt value stored",
    IncorrectPasswordError: "Invalid email or password",
    IncorrectUsernameError: "Invalid email or password",
    MissingUsernameError: "Email is required",
    UserExistsError: "This email is already registered!",
  },
});

module.exports = mongoose.model("User", userSchema);

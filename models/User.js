// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    
    // Profile completion
    profilePicture: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    
    // Preferences
    preferences: {
      newsletter: { type: Boolean, default: true },
      smsUpdates: { type: Boolean, default: true },
      language: { type: String, default: "en" }
    },
    
    addresses: [{
      name: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: "India" },
      addressType: { type: String, enum: ["home", "office", "other"], default: "home" },
      isDefault: { type: Boolean, default: false }
    }],
    
    // Account status
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    tokenVersion: { type: Number, default: 0, select: false }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
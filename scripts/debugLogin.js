// scripts/debugLogin.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";

dotenv.config();

const debugLogin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const adminId = "admin123";
    const password = "adminpassword";

    const admin = await Admin.findOne({ adminId }).select("+password");
    if (!admin) {
      console.log("❌ Admin not found in DB");
    } else {
      console.log("✅ Admin found in DB");
      console.log("Stored Hash:", admin.password);
      
      const isMatch = await bcrypt.compare(password, admin.password);
      console.log("Password Match Result:", isMatch);
      
      if (!isMatch) {
        console.log("Resetting password just in case...");
        const saltRounds = 12;
        const hash = await bcrypt.hash(password, saltRounds);
        admin.password = hash;
        await admin.save();
        console.log("✅ Password reset to 'adminpassword'");
      }
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

debugLogin();

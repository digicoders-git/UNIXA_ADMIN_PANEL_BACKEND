// scripts/seedAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("❌ MONGO_URI is missing in .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const adminId = "admin123";
    const password = "adminpassword"; // Plain text password
    const name = "System Admin";

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ adminId });
    if (existingAdmin) {
      console.log(`ℹ️ Admin with ID '${adminId}' already exists. Updating password...`);
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
      existingAdmin.password = await bcrypt.hash(password, saltRounds);
      existingAdmin.name = name;
      await existingAdmin.save();
      console.log("✅ Admin password updated successfully");
    } else {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await Admin.create({
        adminId,
        password: hashedPassword,
        name
      });
      console.log("✅ Admin created successfully");
    }

    console.log("\n-------------------------------------------");
    console.log("Credentials:");
    console.log(`Admin ID: ${adminId}`);
    console.log(`Password: ${password}`);
    console.log("-------------------------------------------\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding error:", error);
    process.exit(1);
  }
};

seedAdmin();

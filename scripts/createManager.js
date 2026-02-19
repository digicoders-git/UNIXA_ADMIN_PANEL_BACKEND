import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Employee from "../models/Employee.js";

const createManager = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if manager already exists
    const existing = await Employee.findOne({ email: "manager@unixa.com" });
    if (existing) {
      console.log("⚠️ Manager already exists!");
      console.log("Email:", existing.email);
      console.log("Role:", existing.role);
      process.exit(0);
    }

    // Create new manager
    const hashedPassword = await bcrypt.hash("manager123", 10);
    
    const manager = new Employee({
      name: "Test Manager",
      email: "manager@unixa.com",
      phone: "9876543210",
      password: hashedPassword,
      role: "Manager",
      designation: "Operations Manager",
      status: true,
      address: "Test Address",
      joiningDate: new Date()
    });

    await manager.save();
    console.log("✅ Manager created successfully!");
    console.log("📧 Email: manager@unixa.com");
    console.log("🔑 Password: manager123");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

createManager();

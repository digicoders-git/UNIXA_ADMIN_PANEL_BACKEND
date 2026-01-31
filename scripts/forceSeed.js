// scripts/forceSeed.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const forceSeed = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);
    const dbName = mongoose.connection.name;
    console.log("✅ Connected to DB:", dbName);

    const adminId = "admin123";
    const password = "adminpassword";
    const name = "System Admin";

    const hashedPassword = await bcrypt.hash(password, 12);

    const adminsColl = mongoose.connection.db.collection("admins");
    
    // Delete existing if any
    await adminsColl.deleteMany({ adminId });
    
    // Insert new
    await adminsColl.insertOne({
      adminId,
      password: hashedPassword,
      name,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Admin '${adminId}' created successfully in DB '${dbName}'`);
    
    // Double check
    const count = await adminsColl.countDocuments();
    console.log("Total admins in collection:", count);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

forceSeed();

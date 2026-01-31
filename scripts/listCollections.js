// scripts/listCollections.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const listCollections = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB:", mongoose.connection.name);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    const admins = await mongoose.connection.db.collection("admins").find({}).toArray();
    console.log("Admins Count:", admins.length);
    if(admins.length > 0) {
        console.log("Admin IDs:", admins.map(a => a.adminId));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

listCollections();

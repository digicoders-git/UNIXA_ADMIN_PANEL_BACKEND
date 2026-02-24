import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function deleteUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Delete user by email
    const email = 'mp04042007@gmail.com'; // Change this if needed
    
    const result = await collection.deleteOne({ email });
    
    if (result.deletedCount > 0) {
      console.log(`✅ User with email ${email} deleted successfully!`);
    } else {
      console.log(`❌ No user found with email ${email}`);
    }

    // Show remaining users
    const users = await collection.find({}).toArray();
    console.log(`\nTotal users remaining: ${users.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteUser();

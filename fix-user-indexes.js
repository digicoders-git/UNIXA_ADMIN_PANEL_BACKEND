import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\nCurrent indexes:', JSON.stringify(indexes, null, 2));

    // Drop all indexes except _id
    console.log('\nDropping all indexes except _id...');
    await collection.dropIndexes();

    // Recreate proper indexes
    console.log('\nCreating new indexes...');
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex({ phone: 1 }, { unique: true });

    console.log('\n✅ Indexes fixed successfully!');

    // Show all users
    const users = await collection.find({}).toArray();
    console.log(`\nTotal users in database: ${users.length}`);
    if (users.length > 0) {
      console.log('Users:', users.map(u => ({ email: u.email, phone: u.phone })));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndexes();

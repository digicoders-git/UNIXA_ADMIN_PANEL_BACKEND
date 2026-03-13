
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Customer from './models/Customer.js';
import UserAmc from './models/UserAmc.js';
import User from './models/User.js';

dotenv.config();

async function checkCounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/unixa');
    console.log('Connected to MongoDB');

    const orderCount = await Order.countDocuments();
    const customerCount = await Customer.countDocuments();
    const userAmcCount = await UserAmc.countDocuments();
    const userCount = await User.countDocuments();

    console.log(`Orders: ${orderCount}`);
    console.log(`Customers: ${customerCount}`);
    console.log(`UserAmcs: ${userAmcCount}`);
    console.log(`Users: ${userCount}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCounts();

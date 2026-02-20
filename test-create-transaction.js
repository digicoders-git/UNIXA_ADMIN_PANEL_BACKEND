// Test script to create a sample transaction
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from './models/Transaction.js';

dotenv.config();

const createTestTransaction = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    const testTransaction = await Transaction.create({
      transactionId: 'TEST_PAY_' + Date.now(),
      amount: 5000,
      status: 'success',
      paymentMethod: 'Online',
      paymentGateway: 'Razorpay',
      description: 'Test Transaction - Manual Entry'
    });

    console.log('✅ Test transaction created:', testTransaction._id);
    console.log('Now refresh your admin panel transaction page!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createTestTransaction();

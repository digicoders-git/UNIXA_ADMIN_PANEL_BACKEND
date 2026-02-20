// migrate-transactions.js - Create transactions for existing orders
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

dotenv.config();

const migrateTransactions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all orders (without populate to avoid schema issues)
    const orders = await Order.find();
    console.log(`📦 Found ${orders.length} orders`);

    let created = 0;
    let skipped = 0;

    for (const order of orders) {
      // Check if transaction already exists
      const existingTxn = await Transaction.findOne({ orderId: order._id });
      
      if (existingTxn) {
        skipped++;
        continue;
      }

      // Create transaction
      const itemNames = order.items.map(i => i.productName || 'Product').join(', ');
      
      await Transaction.create({
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: order._id,
        userId: order.userId || null,
        amount: order.total,
        status: order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'failed' ? 'failed' : 'pending',
        paymentMethod: order.paymentMethod || 'COD',
        paymentGateway: order.razorpayPaymentId ? 'Razorpay' : (order.paymentMethod === 'COD' ? 'COD' : 'Manual'),
        description: `Order #${order._id.toString().slice(-6)} - ${itemNames}`,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      });

      created++;
      console.log(`✅ Created transaction for order: ${order._id}`);
    }

    console.log(`\n🎉 Migration Complete!`);
    console.log(`✅ Created: ${created} transactions`);
    console.log(`⏭️  Skipped: ${skipped} (already exist)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateTransactions();

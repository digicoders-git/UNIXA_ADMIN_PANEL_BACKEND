// Test script to check AMC activation
import mongoose from 'mongoose';
import Order from './models/Order.js';
import UserAmc from './models/UserAmc.js';
import AmcPlan from './models/AmcPlan.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unixa';

async function testAmcActivation() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find a delivered order with AMC
    const orders = await Order.find({ 
      status: 'delivered',
      userId: { $ne: null }
    }).limit(5);

    console.log(`\n📦 Found ${orders.length} delivered orders\n`);

    for (const order of orders) {
      console.log(`Order ID: ${order._id}`);
      console.log(`User ID: ${order.userId}`);
      console.log(`Items: ${order.items.length}`);
      
      for (const item of order.items) {
        console.log(`\n  Item: ${item.productName}`);
        console.log(`  - amcPlan: ${item.amcPlan || 'NOT SET'}`);
        console.log(`  - amcId: ${item.amcId || 'NOT SET'}`);
        console.log(`  - amcPrice: ${item.amcPrice || 0}`);
        
        if (item.amcPlan) {
          const plan = await AmcPlan.findById(item.amcPlan);
          console.log(`  - Plan Name: ${plan?.name || 'NOT FOUND'}`);
          
          // Check if UserAmc exists
          const userAmc = await UserAmc.findOne({
            orderId: order._id,
            productId: item.product,
            amcPlanId: item.amcPlan
          });
          
          console.log(`  - UserAmc Created: ${userAmc ? '✅ YES' : '❌ NO'}`);
          if (userAmc) {
            console.log(`    - AMC ID: ${userAmc.amcId}`);
            console.log(`    - Status: ${userAmc.status}`);
          }
        }
      }
      console.log('\n' + '='.repeat(60));
    }

    // Check all UserAmcs
    const allAmcs = await UserAmc.find().populate('userId', 'firstName lastName phone');
    console.log(`\n\n📊 Total UserAmcs in database: ${allAmcs.length}`);
    
    allAmcs.forEach(amc => {
      console.log(`\n- ${amc.productName}`);
      console.log(`  User: ${amc.userId?.firstName} ${amc.userId?.lastName}`);
      console.log(`  Plan: ${amc.amcPlanName}`);
      console.log(`  Status: ${amc.status}`);
      console.log(`  Order: ${amc.orderId}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testAmcActivation();

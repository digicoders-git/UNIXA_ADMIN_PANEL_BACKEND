// AMC Plans Verification Script
// Run this to test if AMC plans are saving correctly

import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://digicodersdevelopment_db_user:LsgpfZhoMejwO9Qd@cluster0.le63hap.mongodb.net/unixa?appName=Cluster0';

async function verifyAmcPlans() {
  try {
    console.log('🔍 Connecting to MongoDB...\n');
    await mongoose.connect(MONGO_URI);
    
    // Define schemas
    const ProductSchema = new mongoose.Schema({
      name: String,
      p_id: String,
      amcPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AmcPlan' }]
    });
    
    const AmcPlanSchema = new mongoose.Schema({
      name: String,
      price: Number,
      isActive: Boolean
    });
    
    const Product = mongoose.model('Product', ProductSchema);
    const AmcPlan = mongoose.model('AmcPlan', AmcPlanSchema);
    
    // Check AMC Plans
    console.log('📋 Available AMC Plans:');
    console.log('─'.repeat(50));
    const plans = await AmcPlan.find();
    if (plans.length === 0) {
      console.log('⚠️  No AMC plans found in database!');
      console.log('   Please create AMC plans first in the admin panel.');
    } else {
      plans.forEach((plan, idx) => {
        console.log(`${idx + 1}. ${plan.name}`);
        console.log(`   ID: ${plan._id}`);
        console.log(`   Price: ₹${plan.price}`);
        console.log(`   Active: ${plan.isActive ? '✅' : '❌'}`);
        console.log('');
      });
    }
    
    // Check Products
    console.log('\n📦 Products with AMC Plans:');
    console.log('─'.repeat(50));
    const products = await Product.find().populate('amcPlans');
    
    if (products.length === 0) {
      console.log('⚠️  No products found in database!');
    } else {
      let productsWithPlans = 0;
      let productsWithoutPlans = 0;
      
      products.forEach((product, idx) => {
        const hasPlans = product.amcPlans && product.amcPlans.length > 0;
        
        if (hasPlans) {
          productsWithPlans++;
          console.log(`✅ ${idx + 1}. ${product.name} (${product.p_id})`);
          product.amcPlans.forEach(plan => {
            console.log(`      └─ ${plan.name} (₹${plan.price})`);
          });
        } else {
          productsWithoutPlans++;
          console.log(`❌ ${idx + 1}. ${product.name} (${product.p_id})`);
          console.log(`      └─ No AMC plans assigned`);
        }
        console.log('');
      });
      
      console.log('\n📊 Summary:');
      console.log('─'.repeat(50));
      console.log(`Total Products: ${products.length}`);
      console.log(`With AMC Plans: ${productsWithPlans} ✅`);
      console.log(`Without AMC Plans: ${productsWithoutPlans} ❌`);
      
      if (productsWithoutPlans === products.length) {
        console.log('\n⚠️  WARNING: No products have AMC plans assigned!');
        console.log('   This indicates the save functionality is not working.');
        console.log('\n💡 Next Steps:');
        console.log('   1. Open admin panel and edit a product');
        console.log('   2. Select an AMC plan');
        console.log('   3. Save the product');
        console.log('   4. Check browser console for "DEBUG Frontend" logs');
        console.log('   5. Check backend terminal for "DEBUG:" logs');
        console.log('   6. Run this script again to verify');
      } else {
        console.log('\n✅ SUCCESS: AMC plans are being saved correctly!');
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Verification complete!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAmcPlans();

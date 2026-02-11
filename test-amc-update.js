// Test script to update product with AMC plans
import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://digicodersdevelopment_db_user:LsgpfZhoMejwO9Qd@cluster0.le63hap.mongodb.net/unixa?appName=Cluster0';

async function testUpdate() {
  try {
    await mongoose.connect(MONGO_URI);
    
    const Product = mongoose.model('Product', new mongoose.Schema({
      name: String,
      p_id: String,
      amcPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AmcPlan' }]
    }));
    
    const AmcPlan = mongoose.model('AmcPlan', new mongoose.Schema({
      name: String,
      price: Number
    }));
    
    // Get first product and first AMC plan
    const product = await Product.findOne();
    const plan = await AmcPlan.findOne();
    
    if (!product || !plan) {
      console.log('❌ Product or Plan not found');
      process.exit(1);
    }
    
    console.log('\n📦 Before Update:');
    console.log('Product:', product.name);
    console.log('Current AMC Plans:', product.amcPlans);
    
    // Update using the same logic as controller
    product.amcPlans = [plan._id];
    product.markModified('amcPlans');
    
    await product.save();
    
    console.log('\n✅ After Update:');
    console.log('Product:', product.name);
    console.log('New AMC Plans:', product.amcPlans);
    
    // Verify by fetching again
    const updated = await Product.findById(product._id);
    console.log('\n🔍 Verification (Fresh Fetch):');
    console.log('AMC Plans:', updated.amcPlans);
    
    if (updated.amcPlans.length > 0) {
      console.log('\n✅ SUCCESS: AMC plan saved correctly!');
    } else {
      console.log('\n❌ FAILED: AMC plan not saved!');
    }
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testUpdate();

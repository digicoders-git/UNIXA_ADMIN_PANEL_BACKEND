import mongoose from 'mongoose';
import Customer from './models/Customer.js';
import dotenv from 'dotenv';

dotenv.config();

const checkComplaints = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check total customers
    const totalCustomers = await Customer.countDocuments();
    console.log(`\n📊 Total Customers: ${totalCustomers}`);

    // Check customers with complaints
    const customersWithComplaints = await Customer.find({ 
      "complaints.0": { $exists: true } 
    });
    console.log(`\n📋 Customers with Complaints: ${customersWithComplaints.length}`);

    // Show all complaints
    let totalComplaints = 0;
    customersWithComplaints.forEach(customer => {
      console.log(`\n👤 Customer: ${customer.name} (${customer.mobile})`);
      customer.complaints.forEach(complaint => {
        totalComplaints++;
        console.log(`  🎫 ${complaint.complaintId || 'NO-ID'} - ${complaint.type} - ${complaint.status}`);
        console.log(`     Description: ${complaint.description?.substring(0, 50)}...`);
      });
    });

    console.log(`\n\n✨ Total Complaints in Database: ${totalComplaints}`);

    // Test the aggregation query
    console.log('\n\n🔍 Testing Aggregation Query...');
    const complaints = await Customer.aggregate([
      { $unwind: "$complaints" },
      { $sort: { "complaints.date": -1 } },
      {
        $project: {
          _id: 0,
          customerId: "$_id",
          customerName: "$name",
          customerMobile: "$mobile",
          ticketId: { $ifNull: ["$complaints.complaintId", "$complaints._id"] },
          complaintId: { $ifNull: ["$complaints.complaintId", "$complaints._id"] },
          type: "$complaints.type",
          priority: "$complaints.priority",
          status: "$complaints.status",
          date: "$complaints.date",
          description: "$complaints.description",
          assignedTechnician: "$complaints.assignedTechnician",
          resolutionNotes: "$complaints.resolutionNotes"
        }
      }
    ]);

    console.log(`\n📦 Aggregation Result: ${complaints.length} complaints`);
    if (complaints.length > 0) {
      console.log('\nFirst 3 complaints:');
      complaints.slice(0, 3).forEach(c => {
        console.log(`  🎫 ${c.ticketId} - ${c.customerName} - ${c.type}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkComplaints();

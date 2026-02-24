import mongoose from 'mongoose';
import Customer from './models/Customer.js';
import dotenv from 'dotenv';

dotenv.config();

const addComplaint = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create customer
    let customer = await Customer.findOne({ mobile: "9876543210" });
    
    if (!customer) {
      customer = await Customer.create({
        name: "Test Customer",
        mobile: "9876543210",
        email: "test@example.com",
        address: {
          area: "Test Area",
          city: "Test City"
        },
        type: "AMC Customer"
      });
      console.log('✅ Customer created');
    } else {
      console.log('✅ Customer found:', customer.name);
    }

    // Add the AMC service request complaint
    customer.complaints.push({
      complaintId: "SR-263463",
      type: "AMC Service",
      description: "Service request for Prime RO - AMC ID: AMC1771778844678497",
      date: new Date("2026-02-22T19:41:03.583Z"),
      priority: "Medium",
      status: "Open",
      assignedTechnician: "",
      resolutionNotes: ""
    });

    await customer.save();
    console.log('✅ Complaint added: SR-263463');

    // Verify
    const allComplaints = await Customer.aggregate([
      { $unwind: "$complaints" },
      { $sort: { "complaints.date": -1 } },
      {
        $project: {
          _id: 0,
          customerName: "$name",
          customerMobile: "$mobile",
          ticketId: "$complaints.complaintId",
          type: "$complaints.type",
          status: "$complaints.status",
          date: "$complaints.date"
        }
      }
    ]);

    console.log('\n📦 Total complaints:', allComplaints.length);
    allComplaints.forEach(c => {
      console.log(`  🎫 ${c.ticketId} - ${c.type} - ${c.status}`);
    });

    console.log('\n✨ Done! Refresh the service-requests page');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addComplaint();

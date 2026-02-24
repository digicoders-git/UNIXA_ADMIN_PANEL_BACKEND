import mongoose from 'mongoose';
import Customer from './models/Customer.js';
import AdminNotification from './models/AdminNotification.js';
import dotenv from 'dotenv';

dotenv.config();

const createTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create test customer with complaint
    const testCustomer = await Customer.create({
      name: "Test Customer",
      mobile: "9876543210",
      email: "test@example.com",
      address: {
        house: "123",
        area: "Test Area",
        city: "Test City",
        pincode: "123456"
      },
      type: "New",
      complaints: [
        {
          complaintId: "TKT-00001",
          type: "Service Request",
          description: "Test service request - Water purifier not working properly",
          date: new Date(),
          priority: "High",
          status: "Open",
          assignedTechnician: "",
          resolutionNotes: ""
        },
        {
          complaintId: "TKT-00002",
          type: "Filter Change",
          description: "Need to replace filters - been 6 months",
          date: new Date(),
          priority: "Medium",
          status: "In Progress",
          assignedTechnician: "Rajesh Kumar",
          resolutionNotes: "Technician assigned, will visit tomorrow"
        }
      ]
    });

    console.log('\n✅ Test customer created:', testCustomer.name);
    console.log('📱 Mobile:', testCustomer.mobile);
    console.log('🎫 Complaints:', testCustomer.complaints.length);

    // Create admin notifications
    await AdminNotification.create({
      title: "New Service Request",
      message: `${testCustomer.name} submitted a Service Request - TKT-00001`,
      type: "ServiceRequest",
      refId: "TKT-00001",
      isRead: false
    });

    await AdminNotification.create({
      title: "New Service Request",
      message: `${testCustomer.name} submitted a Filter Change request - TKT-00002`,
      type: "ServiceRequest",
      refId: "TKT-00002",
      isRead: false
    });

    console.log('\n✅ Admin notifications created');

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
          status: "$complaints.status"
        }
      }
    ]);

    console.log('\n📦 Total complaints in database:', allComplaints.length);
    allComplaints.forEach(c => {
      console.log(`  🎫 ${c.ticketId} - ${c.customerName} - ${c.type} - ${c.status}`);
    });

    console.log('\n✨ Test data created successfully!');
    console.log('👉 Now refresh the admin panel service-requests page');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createTestData();


import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function debugData() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const ticketId = 'SR-252180';
  
  console.log('--- Checking Customer Complaints ---');
  const customer = await mongoose.connection.db.collection('customers').findOne({
    "complaints.complaintId": ticketId
  });
  
  if (customer) {
    const complaint = customer.complaints.find(c => c.complaintId === ticketId);
    console.log('Found in Customer:', customer.name);
    console.log('Complaint Details:', complaint);
  } else {
    console.log('NOT found in Customers');
  }

  console.log('\n--- Checking UserAmc Service History ---');
  const userAmc = await mongoose.connection.db.collection('useramcs').findOne({
    "serviceHistory.complaintId": ticketId
  });

  if (userAmc) {
    console.log('Found in UserAmc:', userAmc.productName);
    const historyItem = userAmc.serviceHistory.find(h => h.complaintId === ticketId);
    console.log('History Item:', historyItem);
  } else {
    console.log('NOT found in UserAmcs with complaintId:', ticketId);
    
    // Check all userAmcs to see if any have serviceHistory items without complaintId
    const someAmc = await mongoose.connection.db.collection('useramcs').findOne({
      "serviceHistory.0": { $exists: true }
    });
    if (someAmc) {
        console.log('Sample UserAmc History Item:', someAmc.serviceHistory[0]);
    }
  }

  await mongoose.connection.close();
}

debugData();

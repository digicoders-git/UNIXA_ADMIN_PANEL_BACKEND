
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function debugData() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const ticketId = 'SR-252180';
  
  console.log('--- 1. Checking Customer Collection ---');
  const customer = await mongoose.connection.db.collection('customers').findOne({
    "complaints.complaintId": ticketId
  });
  
  if (customer) {
    const complaint = customer.complaints.find(c => c.complaintId === ticketId);
    console.log(`Found Customer: ${customer.name} (${customer.mobile})`);
    console.log('Complaint in Customer:', JSON.stringify(complaint, null, 2));
  } else {
    console.log(`Ticket ${ticketId} NOT FOUND in Customer complaints`);
  }

  console.log('\n--- 2. Checking UserAmc Collection ---');
  const userAmc = await mongoose.connection.db.collection('useramcs').findOne({
    "serviceHistory.complaintId": ticketId
  });

  if (userAmc) {
    console.log(`Found UserAmc: ${userAmc.productName} for User: ${userAmc.userId}`);
    const historyItem = userAmc.serviceHistory.find(h => h.complaintId === ticketId);
    console.log('History Item in UserAmc:', JSON.stringify(historyItem, null, 2));
  } else {
    console.log(`Ticket ${ticketId} NOT FOUND in UserAmc service history (by complaintId)`);
    
    // Try finding by userId and approximate date/reason
    if (customer) {
        console.log('\n--- 3. Searching UserAmc by userId and matching history ---');
        // We don't have direct userId in Customer usually, but we have mobile
        const user = await mongoose.connection.db.collection('users').findOne({ phone: customer.mobile });
        if (user) {
            console.log(`Found User: ${user.name} (${user._id})`);
            const allUserAmcs = await mongoose.connection.db.collection('useramcs').find({ userId: user._id }).toArray();
            console.log(`User has ${allUserAmcs.length} AMCs`);
            
            allUserAmcs.forEach(amc => {
                amc.serviceHistory.forEach(h => {
                    console.log(`  - AMC ${amc.productName} History Item: Type=${h.type}, Date=${new Date(h.date).toISOString()}, CompId=${h.complaintId}`);
                });
            });
        }
    }
  }

  await mongoose.connection.close();
}

debugData();

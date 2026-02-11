
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function fixData() {
  await mongoose.connect(process.env.MONGO_URI);
  
  console.log('--- Starting Migration: Linking Customer Complaints to UserAmc History ---');
  
  const customers = await mongoose.connection.db.collection('customers').find({
    "complaints.0": { $exists: true }
  }).toArray();

  for (const customer of customers) {
    console.log(`Processing Customer: ${customer.name}`);
    
    // Find the associated user to get userId
    const user = await mongoose.connection.db.collection('users').findOne({ 
        $or: [{ phone: customer.mobile }, { email: customer.email }] 
    });
    
    if (!user) {
        console.log(`  ! User record not found for mobile ${customer.mobile}`);
        continue;
    }

    for (const complaint of customer.complaints) {
        if (!complaint.complaintId) continue;
        
        console.log(`  - Checking Complaint: ${complaint.complaintId} (${complaint.type})`);
        
        // Try to find a UserAmc history item that matches this complaint but lacks a complaintId
        // We match by userId and approximate date (same day)
        const complaintDate = new Date(complaint.date);
        const startOfDay = new Date(complaintDate.setHours(0,0,0,0));
        const endOfDay = new Date(complaintDate.setHours(23,59,59,999));

        const userAmc = await mongoose.connection.db.collection('useramcs').findOne({
            userId: user._id,
            "serviceHistory": {
                $elemMatch: {
                    complaintId: { $exists: false },
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            }
        });

        if (userAmc) {
            console.log(`    MATCH FOUND: UserAmc ${userAmc.productName}`);
            // Update the specific history item
            await mongoose.connection.db.collection('useramcs').updateOne(
                { _id: userAmc._id, "serviceHistory.date": { $gte: startOfDay, $lte: endOfDay }, "serviceHistory.complaintId": { $exists: false } },
                { 
                    $set: { 
                        "serviceHistory.$.complaintId": complaint.complaintId,
                        "serviceHistory.$.technicianName": complaint.assignedTechnician || 'Pending Assignment',
                        "serviceHistory.$.notes": complaint.resolutionNotes || ''
                    } 
                }
            );
            console.log(`    ✅ Linked ${complaint.complaintId} to ${userAmc.productName}`);
        } else {
            // Check if it's already linked
            const alreadyLinked = await mongoose.connection.db.collection('useramcs').findOne({
                "serviceHistory.complaintId": complaint.complaintId
            });
            if (alreadyLinked) {
                console.log(`    (Already linked)`);
                // Force update technician just in case it missed the sync
                await mongoose.connection.db.collection('useramcs').updateOne(
                    { _id: alreadyLinked._id, "serviceHistory.complaintId": complaint.complaintId },
                    { 
                        $set: { 
                            "serviceHistory.$.technicianName": complaint.assignedTechnician || 'Pending Assignment',
                            "serviceHistory.$.notes": complaint.resolutionNotes || ''
                        } 
                    }
                );
            } else {
                console.log(`    ? No matching history item found in UserAmcs for this date`);
            }
        }
    }
  }

  console.log('\n--- Migration Finished ---');
  await mongoose.connection.close();
}

fixData();

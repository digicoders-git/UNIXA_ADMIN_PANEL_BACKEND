import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanupTicketTypes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update any invalid ticketType values
    const result = await mongoose.connection.db.collection('assignedtickets').updateMany(
      { ticketType: { $nin: ["service_request", "order", "lead"] } },
      { $set: { ticketType: "lead" } }
    );

    console.log(`Updated ${result.modifiedCount} documents with invalid ticketType`);

    // Drop the model from mongoose cache
    if (mongoose.models.AssignedTicket) {
      delete mongoose.models.AssignedTicket;
    }

    console.log('Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
};

cleanupTicketTypes();
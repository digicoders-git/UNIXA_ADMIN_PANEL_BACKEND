import mongoose from 'mongoose';

const assignedTicketSchema = new mongoose.Schema({
  ticketType: { type: String, enum: ['service_request', 'order'], required: true },
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  title: { type: String, required: true },
  description: { type: String },
  assignedBy: { type: String, required: true },
  assignedTo: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  dueDate: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },
  address: { type: String },
  notes: { type: String },
  amcId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAmc' },
  completionPhoto: { type: String },
  completedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('AssignedTicket', assignedTicketSchema);

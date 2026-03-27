import mongoose from 'mongoose';

const assignedTicketSchema = new mongoose.Schema({
  ticketType: {
    type: String,
    enum: {
      values: ["service_request", "order", "lead", "complaint"],
      message: '{VALUE} is not a valid ticket type'
    },
    required: true
  },
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  title: { type: String, required: true },
  description: { type: String },
  assignedBy: { type: String, required: true },
  assignedTo: { type: String, required: true, index: true }, // Add index for faster employee queries
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending', index: true },
  dueDate: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String },
  customerPhone: { type: String },
  customerEmail: { type: String },
  address: { type: String },
  notes: { type: String },
  amcId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAmc' },
  completionPhotos: [{ type: String }],
  completionRemark: { type: String },
  completedAt: { type: Date },
  visitType: { type: String, enum: ['AMC_REMINDER', 'SERVICE_REQUEST', 'INSTALLATION'], default: 'SERVICE_REQUEST' },
  assignedByRole: { type: String, enum: ['Admin', 'Manager'], default: 'Admin' },
  employeeFeedback: { type: String },
  visitPhotos: [{ type: String }],
  customerFeedback: { type: String }
}, { timestamps: true });

// Compound indexes for optimized queries
assignedTicketSchema.index({ assignedTo: 1, status: 1 });
assignedTicketSchema.index({ assignedTo: 1, createdAt: -1 });
assignedTicketSchema.index({ ticketType: 1 });

export default mongoose.model('AssignedTicket', assignedTicketSchema);

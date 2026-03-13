import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amcId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAmc"
  },
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  address: String,
  type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  },
  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved", "Cancelled"],
    default: "Open"
  },
  assignedTechnician: String,
  resolutionNotes: String,
  completionRemark: String,
  completionPhotos: [String],
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
serviceRequestSchema.index({ ticketId: 1 });
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ createdAt: -1 });
serviceRequestSchema.index({ userId: 1 });

export default mongoose.model("ServiceRequest", serviceRequestSchema);

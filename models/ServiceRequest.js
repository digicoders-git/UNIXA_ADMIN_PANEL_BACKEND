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
  completionPhoto: String,
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model("ServiceRequest", serviceRequestSchema);

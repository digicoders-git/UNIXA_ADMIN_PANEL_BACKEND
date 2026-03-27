import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customerAddress: String,
  type: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  status: { type: String, enum: ["Open", "In Progress", "Resolved", "Cancelled"], default: "Open" },
  relatedItemType: { type: String, enum: ["Order", "AMC", "General"], default: "General" },
  relatedItemId: String,
  relatedItemName: String,
  assignedTechnician: String,
  resolutionNotes: String,
}, { timestamps: true });

complaintSchema.index({ userId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ createdAt: -1 });

export default mongoose.model("Complaint", complaintSchema);

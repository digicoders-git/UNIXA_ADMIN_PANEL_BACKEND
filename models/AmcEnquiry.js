import mongoose from "mongoose";

const amcEnquirySchema = new mongoose.Schema({
  // Customer info
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // Plan & Product selection
  amcPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "AmcPlan" },
  amcPlanName: { type: String, required: true },
  productName: { type: String },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  duration: { type: String }, // "1 Year", "2 Years", "3 Years"
  price: { type: Number },

  // Source
  source: { type: String, enum: ["website", "user_panel"], default: "website" },
  notes: { type: String },

  // Admin workflow
  status: { type: String, enum: ["Pending", "Verified", "Activated", "Rejected"], default: "Pending" },
  adminNotes: { type: String },
  activatedAmcId: { type: mongoose.Schema.Types.ObjectId, ref: "UserAmc" },

  // Payment (filled by admin at activation)
  paymentMode: { type: String, enum: ["Cash", "Online", "UPI", "Cheque", "Free"], default: "Cash" },
  amountPaid: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["Paid", "Partial", "Pending"], default: "Pending" },
}, { timestamps: true });

export default mongoose.model("AmcEnquiry", amcEnquirySchema);

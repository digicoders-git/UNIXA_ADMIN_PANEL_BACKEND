// models/Enquiry.js
import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "in-progress", "resolved"],
      default: "new",
    },
    isRead: { type: Boolean, default: false },
    address: { type: String, default: "" },
    productInterest: { type: String, default: "" },
    leadStatus: { type: String, enum: ["Hot", "Warm", "Cold"], default: "Warm" },
    notes: { type: String, default: "" },
    followUpDate: { type: Date },
    source: { type: String, default: "Field Visit" }
  },
  { timestamps: true }
);

export default mongoose.model("Enquiry", enquirySchema);

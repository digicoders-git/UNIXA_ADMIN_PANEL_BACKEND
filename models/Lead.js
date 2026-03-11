import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    productInterest: { type: String, default: "" },
    leadStatus: { type: String, enum: ["Hot", "Warm", "Cold"], default: "Warm" },
    notes: { type: String, default: "" },
    followUpDate: { type: Date },
    source: { type: String, default: "Field Visit" },
    createdBy: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);

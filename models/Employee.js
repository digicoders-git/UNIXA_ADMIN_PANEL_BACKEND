import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Employee" }, // e.g., Manager, Staff, etc.
    designation: { type: String },
    status: { type: Boolean, default: true },
    address: { type: String },
    joiningDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);

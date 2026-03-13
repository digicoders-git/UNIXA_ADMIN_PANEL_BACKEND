import mongoose from "mongoose";

const employeeNotificationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["Info", "Success", "Alert", "Job", "System"],
      default: "Info"
    },
    refId: { type: String }, 
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeNotification", employeeNotificationSchema);

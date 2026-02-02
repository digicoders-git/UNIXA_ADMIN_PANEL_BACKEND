import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: { 
        type: String, 
        enum: ["All", "Customers", "Employees"], 
        default: "All" 
    },
    type: { 
        type: String, 
        enum: ["Info", "Warning", "Alert", "Success"], 
        default: "Info" 
    },
    status: { type: String, enum: ["Sent", "Draft"], default: "Sent" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);

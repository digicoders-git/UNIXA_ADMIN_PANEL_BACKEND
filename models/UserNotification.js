import mongoose from "mongoose";

const userNotificationSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["Info", "Success", "Alert", "Service"], 
      default: "Info" 
    },
    refId: { type: String }, // Links to Ticket ID or Order ID
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("UserNotification", userNotificationSchema);

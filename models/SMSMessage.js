import mongoose from "mongoose";

const smsMessageSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ["inbound", "outbound"],
    required: true
  },
  status: {
    type: String,
    enum: ["received", "sent", "failed"],
    default: "sent"
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SMSMessage = mongoose.model("SMSMessage", smsMessageSchema);
export default SMSMessage;

import mongoose from "mongoose";

const refundRequestSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { 
        type: String, 
        enum: ["Cancellation", "Return"], 
        required: true 
    },
    reason: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["Pending", "Approved", "Rejected", "Refunded"], 
        default: "Pending" 
    },
    transactionId: { type: String }, // If refunded via payment gateway
    bankDetails: {
        accountHolderName: String,
        bankName: String,
        accountNumber: String,
        ifscCode: String,
        upiId: String
    },
    adminComments: { type: String },
    images: [{ type: String }], // Evidence for return if needed
  },
  { timestamps: true }
);

export default mongoose.model("RefundRequest", refundRequestSchema);

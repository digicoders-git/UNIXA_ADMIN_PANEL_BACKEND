// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      default: "Online",
    },
    paymentGateway: {
      type: String,
      default: "Razorpay",
    },
    gatewayResponse: {
      type: Object, // To store full response from gateway for debugging
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ["order", "amc", "rental", "service", "refund"],
      default: "order",
    },
    referenceId: {
      type: String, // AMC ID, Rental ID, etc.
    },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);

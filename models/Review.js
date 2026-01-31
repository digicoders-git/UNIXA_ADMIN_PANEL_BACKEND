import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    user: {
      type: String, // Storing name directly for simplicity as per request context
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve for now based on "dynamic show" urgency
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);

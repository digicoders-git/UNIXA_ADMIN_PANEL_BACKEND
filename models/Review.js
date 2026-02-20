import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: false,
    },
    user: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "Customer"
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
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isTestimonial: {
      type: Boolean,
      default: true,
    },
    showInSlider: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);

import mongoose from "mongoose";

const rentalPlanSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    features: {
      type: [String],
      default: [],
    },
    tag: {
      type: String,
      default: "",
    },
    image: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
    installationCost: {
      type: String,
      default: "Free",
    },
    deposit: {
      type: String,
      default: "None",
    },
    billingCycle: {
      type: String,
      default: "Monthly",
    },
    amcPlans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AmcPlan",
      },
    ],
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const RentalPlan = mongoose.model("RentalPlan", rentalPlanSchema);
export default RentalPlan;

import mongoose from "mongoose";

const amcPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., Basic Care, Premium Care
  price: { type: Number, required: true },
  durationMonths: { type: Number, default: 12 },
  features: [{ type: String }],
  color: { type: String, default: "blue" }, // for UI theming
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  servicesIncluded: { type: Number, default: 2 },
  partsIncluded: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("AmcPlan", amcPlanSchema);

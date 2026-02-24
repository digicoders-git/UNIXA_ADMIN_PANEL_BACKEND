import mongoose from "mongoose";

const amcPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., Basic Care, Premium Care
  amcType: { type: String, enum: ["Free", "Paid"], default: "Paid" },
  price: { type: Number, required: true },
  durationMonths: { type: Number, default: 12 },
  servicesIncluded: { type: Number, default: 3 },
  features: [{ type: String }],
  color: { type: String, default: "blue" }, // for UI theming
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  partsIncluded: { type: Boolean, default: false },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
}, { timestamps: true });

export default mongoose.model("AmcPlan", amcPlanSchema);

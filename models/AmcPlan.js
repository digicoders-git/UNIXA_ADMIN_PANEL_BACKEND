import mongoose from "mongoose";

const productAmcConfigSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  rateOneYear: { type: Number, default: 0 },
  rateTwoYear: { type: Number, default: 0 },
  rateThreeYear: { type: Number, default: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  serviceSchedule: {
    type: { type: String, enum: ["Half Yearly", "Quarterly"], default: "Half Yearly" },
    intervalMonths: { type: Number, default: 6 },
  }
}, { _id: false });

const amcPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amcType: { type: String, enum: ["Free", "Paid"], default: "Paid" },
  price: { type: Number, default: 0 }, // backward compat
  servicesIncluded: { type: Number, default: 3 },
  features: [{ type: String }],
  color: { type: String, default: "blue" },
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  partsIncluded: { type: Boolean, default: false },
  // Per-product AMC config
  productConfigs: [productAmcConfigSchema],
  // legacy
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
}, { timestamps: true });

export default mongoose.model("AmcPlan", amcPlanSchema);

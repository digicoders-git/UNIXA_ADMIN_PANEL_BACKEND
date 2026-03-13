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
  
  // Mandatory service schedule
  serviceSchedule: {
    intervalMonths: { type: Number, default: 4 }, // Service every 4 months
    serviceType: { 
      type: String, 
      enum: ["Installation", "Regular Service", "Repair", "Filter Change", "Other"],
      default: "Regular Service"
    },
    description: { type: String, default: "Scheduled maintenance service" }
  }
}, { timestamps: true });

export default mongoose.model("AmcPlan", amcPlanSchema);

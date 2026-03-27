// models/RoPart.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const roPartSchema = new mongoose.Schema(
  {
    p_id: { type: String, unique: true, sparse: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    finalPrice: { type: Number, default: 0 },
    mainImage: { type: imageSchema, required: true },
    description: { type: String, default: "" },
    warrantyYears: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnWebsite: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

roPartSchema.pre("save", function (next) {
  const discount = this.discountPercent || 0;
  this.finalPrice = Math.round(this.price * (1 - discount / 100));
  next();
});

export default mongoose.model("RoPart", roPartSchema);

// models/Product.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const addOnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const specificationSchema = new mongoose.Schema(
  {
    brand: { type: String, default: "", trim: true },
    warranty: { type: String, default: "", trim: true },
    weight: { type: String, default: "", trim: true },
    frameType: { type: String, default: "", trim: true },
    material: { type: String, default: "", trim: true },
    dimensions: { type: String, default: "", trim: true },
    installation: { type: String, default: "", trim: true },
    glassType: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {

    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    p_id: { type: String, unique: true, index: true, trim: true }, 


    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },

    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    finalPrice: { type: Number, default: 0 },

    mainImage: { type: imageSchema, required: true },
    galleryImages: [imageSchema],

    sizes: [{ type: String, trim: true }],
    colors: [{ type: String, trim: true }],
    addOns: { type: [addOnSchema], default: [] },

    description: { type: String, default: "" },
    about: { type: String, default: "" },

    specifications: { type: specificationSchema, default: () => ({}) },
    features: [{ type: String, trim: true }],

    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug =
      this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "") + "-" + Date.now();
  }

  const discount = this.discountPercent || 0;
  this.finalPrice = Math.round(this.price * (1 - discount / 100));

  if (!this.addOns || this.addOns.length === 0) {
    this.addOns = [{ name: "None", price: 0, isDefault: true }];
  } else {
    const hasDefault = this.addOns.some((a) => a.isDefault);
    if (!hasDefault) {
      this.addOns.unshift({ name: "None", price: 0, isDefault: true });
    }
  }

  next();
});

export default mongoose.model("Product", productSchema);

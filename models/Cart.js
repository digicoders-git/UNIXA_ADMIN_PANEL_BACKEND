// models/Cart.js
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  size: { type: String },
  color: { type: String },
  addOnName: { type: String, default: "None" },
  addOnPrice: { type: Number, default: 0 }
}, { _id: false });

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [cartItemSchema],
    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

cartSchema.pre("save", function(next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  next();
});

export default mongoose.model("Cart", cartSchema);
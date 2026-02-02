import mongoose from "mongoose";

const inventoryLogSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    change: { type: Number, required: true }, // +10 or -5
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, required: true }, // e.g., "New Shipment", "Adjustment", "Damaged"
    note: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryLog", inventoryLogSchema);

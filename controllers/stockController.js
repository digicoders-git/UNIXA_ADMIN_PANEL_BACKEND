import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";

// Get Stock List
export const getStockOverview = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } }
      ];
    }

    const products = await Product.find(query).select("name mainImage price stock lowStockThreshold isActive");
    
    // Filter by logic if needed (e.g., low stock)
    let finalProducts = products;
    if (status === "Low Stock") {
        finalProducts = products.filter(p => p.stock <= p.lowStockThreshold && p.stock > 0);
    } else if (status === "Out of Stock") {
        finalProducts = products.filter(p => p.stock === 0);
    } else if (status === "In Stock") {
        finalProducts = products.filter(p => p.stock > p.lowStockThreshold);
    }

    // Sort to show low stock first usually helpful
    finalProducts.sort((a,b) => a.stock - b.stock);

    res.json(finalProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Stock
export const updateStock = async (req, res) => {
  try {
    const { id, quantity, type, reason, note } = req.body; 
    // quantity: number to change (always positive from frontend), type: "Add" or "Remove"

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const changeAmount = type === "Add" ? Number(quantity) : -Number(quantity);
    const oldStock = product.stock;
    const newStock = oldStock + changeAmount;

    if (newStock < 0) {
        return res.status(400).json({ message: "Insufficient stock for this operation" });
    }

    product.stock = newStock;
    await product.save();

    // Log it
    const log = new InventoryLog({
        productId: product._id,
        change: changeAmount,
        previousStock: oldStock,
        newStock: newStock,
        reason: reason || (type === "Add" ? "Manual Restock" : "Manual Adjustment"),
        note
    });
    await log.save();

    res.json({ message: "Stock updated successfully", product });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get History for a Product
export const getStockHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await InventoryLog.find({ productId: id }).sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

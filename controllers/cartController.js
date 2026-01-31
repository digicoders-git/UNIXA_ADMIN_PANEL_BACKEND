// controllers/cartController.js
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Get Cart
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    
    if (!cart) {
      cart = await Cart.create({ user: req.user.sub, items: [] });
    }

    // Calculate total amount
    let totalAmount = 0;
    cart.items = cart.items.filter(item => {
      if (!item.product) return false;
      
      const itemTotal = (item.product.finalPrice + item.addOnPrice) * item.quantity;
      totalAmount += itemTotal;
      return true;
    });

    cart.totalAmount = totalAmount;
    await cart.save();

    res.json({ cart });
  } catch (err) {
    console.error("getCart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add to Cart
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, size, color, addOnName = "None", addOnPrice = 0 } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    let cart = await Cart.findOne({ user: req.user.sub });
    if (!cart) {
      cart = await Cart.create({ user: req.user.sub, items: [] });
    }

    // Check if item already exists with same variant
    const existingItemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId && 
      item.size === size && 
      item.color === color && 
      item.addOnName === addOnName
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, size, color, addOnName, addOnPrice });
    }

    await cart.save();
    await cart.populate("items.product");

    res.json({ message: "Item added to cart", cart });
  } catch (err) {
    console.error("addToCart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Cart Item
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Valid quantity is required" });
    }

    const cart = await Cart.findOne({ user: req.user.sub });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

    item.quantity = quantity;
    await cart.save();
    await cart.populate("items.product");

    res.json({ message: "Cart updated", cart });
  } catch (err) {
    console.error("updateCartItem error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove from Cart
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: req.user.sub });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items.pull(itemId);
    await cart.save();
    await cart.populate("items.product");

    res.json({ message: "Item removed from cart", cart });
  } catch (err) {
    console.error("removeFromCart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Clear Cart
export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.sub });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;
    await cart.save();

    res.json({ message: "Cart cleared", cart });
  } catch (err) {
    console.error("clearCart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Cart Total for Payment
export const getCartTotal = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let totalAmount = 0;
    cart.items = cart.items.filter(item => {
      if (!item.product || !item.product.isActive) return false;
      
      const itemTotal = (item.product.finalPrice + item.addOnPrice) * item.quantity;
      totalAmount += itemTotal;
      return true;
    });

    res.json({ 
      totalAmount,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      items: cart.items
    });
  } catch (err) {
    console.error("getCartTotal error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
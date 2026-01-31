// controllers/wishlistController.js
import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";

// Get Wishlist
export const getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.sub }).populate("products");
    
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.sub, products: [] });
    }

    // Filter out inactive products
    wishlist.products = wishlist.products.filter(product => product && product.isActive);
    await wishlist.save();

    res.json({ wishlist });
  } catch (err) {
    console.error("getWishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add to Wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.sub });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.sub, products: [] });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    await wishlist.populate("products");
    res.json({ message: "Product added to wishlist", wishlist });
  } catch (err) {
    console.error("addToWishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove from Wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: req.user.sub });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

    wishlist.products.pull(productId);
    await wishlist.save();
    await wishlist.populate("products");

    res.json({ message: "Product removed from wishlist", wishlist });
  } catch (err) {
    console.error("removeFromWishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Toggle Wishlist (add if not exists, remove if exists)
export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    let wishlist = await Wishlist.findOne({ user: req.user.sub });
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user.sub, products: [] });
    }

    const isInWishlist = wishlist.products.includes(productId);
    
    if (isInWishlist) {
      wishlist.products.pull(productId);
      await wishlist.save();
      await wishlist.populate("products");
      return res.json({ message: "Product removed from wishlist", wishlist, action: "removed" });
    } else {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: "Product not found or inactive" });
      }
      
      wishlist.products.push(productId);
      await wishlist.save();
      await wishlist.populate("products");
      return res.json({ message: "Product added to wishlist", wishlist, action: "added" });
    }
  } catch (err) {
    console.error("toggleWishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
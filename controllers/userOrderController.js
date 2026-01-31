// controllers/userOrderController.js
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Offer from "../models/Offer.js";
import User from "../models/User.js";

// Place Order
export const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod = "COD", offerCode, notes } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    // Get user and address
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ message: "Address not found" });

    // Get cart
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      if (!item.product || !item.product.isActive) {
        return res.status(400).json({ message: `Product ${item.product?.name || 'unknown'} is not available` });
      }

      const itemPrice = item.product.finalPrice + item.addOnPrice;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: item.product._id,
        productName: item.product.name,
        productPrice: itemPrice,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        addOnName: item.addOnName
      });
    }

    // Apply offer if provided
    let discount = 0;
    if (offerCode) {
      const offer = await Offer.findOne({ 
        code: offerCode, 
        isActive: true,
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: new Date() } }
        ],
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: new Date() } }
        ]
      });

      if (!offer) {
        return res.status(400).json({ message: "Invalid or expired offer code" });
      }

      if (subtotal < offer.minOrderAmount) {
        return res.status(400).json({ 
          message: `Minimum order amount ₹${offer.minOrderAmount} required for this offer` 
        });
      }

      if (offer.discountType === "percentage") {
        discount = Math.round(subtotal * offer.discountValue / 100);
        if (offer.maxDiscountAmount > 0) {
          discount = Math.min(discount, offer.maxDiscountAmount);
        }
      } else {
        discount = offer.discountValue;
      }
    }

    const total = subtotal - discount;

    // Create order
    const order = await Order.create({
      userId: req.user.sub,
      items: orderItems,
      subtotal,
      discount,
      total,
      offerCode,
      paymentMethod,
      shippingAddress: address.toObject(),
      notes: notes || ""
    });

    // Clear cart
    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;
    await cart.save();

    res.status(201).json({ 
      message: "Order placed successfully", 
      order,
      orderId: order._id 
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get User Orders
export const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { userId: req.user.sub };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("items.product", "name slug mainImage");

    const total = await Order.countDocuments(filter);

    res.json({ 
      orders, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("getUserOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Single Order
export const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub 
    }).populate("items.product", "name slug mainImage");

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ order });
  } catch (err) {
    console.error("getOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Cancel Order
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub 
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Order cannot be cancelled" });
    }

    order.status = "cancelled";
    await order.save();

    res.json({ message: "Order cancelled successfully", order });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Track Order
export const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub 
    }, "status paymentStatus createdAt updatedAt");

    if (!order) return res.status(404).json({ message: "Order not found" });

    const statusFlow = {
      pending: { step: 1, message: "Order placed successfully" },
      confirmed: { step: 2, message: "Order confirmed by seller" },
      shipped: { step: 3, message: "Order shipped" },
      delivered: { step: 4, message: "Order delivered" },
      cancelled: { step: 0, message: "Order cancelled" }
    };

    res.json({ 
      orderId: order._id,
      currentStatus: order.status,
      paymentStatus: order.paymentStatus,
      tracking: statusFlow[order.status],
      orderDate: order.createdAt,
      lastUpdate: order.updatedAt
    });
  } catch (err) {
    console.error("trackOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
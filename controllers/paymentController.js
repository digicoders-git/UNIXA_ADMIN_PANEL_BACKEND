// controllers/paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";

// Initialize Razorpay lazily or handle missing keys gracefully
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay keys are missing in .env. Payment features will not work.");
}

// Create Razorpay Order
export const createPaymentOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;
    
    if (!razorpay) {
      return res.status(503).json({ message: "Payment service is currently unavailable (Keys missing)" });
    }

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("createPaymentOrder error:", err);
    res.status(500).json({ message: "Payment order creation failed" });
  }
};

// Verify Payment and Create Order
export const verifyPaymentAndCreateOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      shippingAddress,
      notes = "",
      offerCode = "",
    } = req.body;

    if (!razorpay) {
      return res.status(503).json({ message: "Payment service is currently unavailable (Keys missing)" });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }

    // Get user cart
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = cart.items.map(item => {
      const itemTotal = (item.product.finalPrice + item.addOnPrice) * item.quantity;
      subtotal += itemTotal;
      return {
        product: item.product._id,
        productName: item.product.name,
        productPrice: item.product.finalPrice,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        addOnName: item.addOnName,
      };
    });

    // Create order
    const order = await Order.create({
      userId: req.user.sub,
      items: orderItems,
      subtotal,
      total: subtotal,
      offerCode,
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "Online",
      shippingAddress,
      notes,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    // Clear cart
    await Cart.findOneAndUpdate(
      { user: req.user.sub },
      { items: [], totalItems: 0, totalAmount: 0 }
    );

    res.json({
      success: true,
      message: "Payment successful and order created",
      order,
    });
  } catch (err) {
    console.error("verifyPaymentAndCreateOrder error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Payment verification failed" 
    });
  }
};

// Handle Payment Failure
export const handlePaymentFailure = async (req, res) => {
  try {
    const { razorpay_order_id, error } = req.body;

    res.json({
      success: false,
      message: "Payment failed. Please try again.",
      error: error?.description || "Payment was not completed",
    });
  } catch (err) {
    console.error("handlePaymentFailure error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error handling payment failure" 
    });
  }
};
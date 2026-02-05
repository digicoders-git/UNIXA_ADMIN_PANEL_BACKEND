// controllers/orderController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import RoPart from "../models/RoPart.js";
import Offer from "../models/Offer.js";
import Customer from "../models/Customer.js";
import User from "../models/User.js";

const applyOffer = (offer, subtotal) => {
  if (!offer) return { discount: 0, total: subtotal };
  if (offer.minOrderAmount && subtotal < offer.minOrderAmount) {
    return { discount: 0, total: subtotal };
  }
  let discount = 0;
  if (offer.discountType === "percentage") {
    discount = (subtotal * offer.discountValue) / 100;
  } else {
    discount = offer.discountValue;
  }
  if (offer.maxDiscountAmount && discount > offer.maxDiscountAmount) {
    discount = offer.maxDiscountAmount;
  }
  const total = Math.max(0, subtotal - discount);
  return { discount: Math.round(discount), total: Math.round(total) };
};

// PLACE ORDER (public)
export const placeOrder = async (req, res) => {
  try {
    const { userId, items, shippingAddress, offerCode, paymentMethod, notes } =
      req.body;

    console.log("Place Order Attempt:", { userId, itemsCount: items?.length });

    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "userId and items are required" });
    }
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone) {
      return res.status(400).json({ message: "shippingAddress is invalid" });
    }

    const productIds = items.map((i) => i.productId).filter(id => id);
    console.log("Extracted Product IDs:", productIds);
    
    // Fetch from both collections
    const [products, roParts] = await Promise.all([
      Product.find({ _id: { $in: productIds } }),
      RoPart.find({ _id: { $in: productIds } })
    ]);

    console.log(`Found ${products.length} products and ${roParts.length} RO parts`);

    const itemsForOrder = [];
    let subtotal = 0;

    for (const item of items) {
      console.log("Checking item:", item.productId);
      // Check in products first
      let itemData = products.find(
        (p) => String(p._id) === String(item.productId)
      );
      let type = "Product";

      // If not in products, check in roParts
      if (!itemData) {
        itemData = roParts.find(
          (p) => String(p._id) === String(item.productId)
        );
        type = "RoPart";
      }

      if (!itemData) {
        console.log("❌ Item not found in either collection:", item.productId);
        return res
          .status(400)
          .json({ message: `Invalid productId: ${item.productId}` });
      }
      const qty = Number(item.quantity || 1);
      const linePrice = itemData.finalPrice * qty;
      subtotal += linePrice;

      itemsForOrder.push({
        product: itemData._id,
        productType: type, // Store the model type for refPath
        productName: itemData.name,
        productPrice: itemData.finalPrice,
        quantity: qty,
        size: item.size,
        color: item.color,
        addOnName: item.addOnName,
        // Generate Dynamic Warranty & AMC
        warrantyId: `WAR${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`,
        warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        amcId: `AMC${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`,
        amcPlan: 'Standard Protection (1 Year)',
      });
    }

    let offer = null;
    if (offerCode) {
      const now = new Date();
      const code = String(offerCode).toUpperCase();
      offer = await Offer.findOne({ code, isActive: true });
      if (
        offer &&
        ((offer.startDate && offer.startDate > now) ||
          (offer.endDate && offer.endDate < now))
      ) {
        offer = null;
      }
    }
    const { discount, total } = applyOffer(offer, subtotal);

    const order = await Order.create({
      userId,
      items: itemsForOrder,
      subtotal,
      discount,
      total,
      offerCode: offer ? offer.code : undefined,
      paymentMethod: paymentMethod || "COD",
      shippingAddress,
      notes,
    });

    // Sync with Customer Database
    try {
      const user = await User.findById(userId);
      if (user) {
        let customer = await Customer.findOne({ mobile: shippingAddress.phone }) || 
                       await Customer.findOne({ email: user.email });

        if (!customer) {
           customer = new Customer({
             name: shippingAddress.name,
             mobile: shippingAddress.phone,
             email: user.email,
             address: {
               house: shippingAddress.addressLine1,
               city: shippingAddress.city,
               pincode: shippingAddress.pincode
             },
             type: 'New',
             status: 'Active'
           });
        }

        // Add new purifiers from this order
        itemsForOrder.forEach(item => {
           customer.purifiers.push({
             brand: 'Unixa', // Default or from product
             model: item.productName,
             type: 'RO', // Default
             installationDate: new Date(),
             warrantyStatus: 'Active',
             amcStatus: 'Active'
           });
           
           // Add to AMC History/Active
           customer.amcDetails = {
             amcId: item.amcId,
             planName: item.amcPlan,
             planType: 'Silver',
             startDate: new Date(),
             endDate: item.warrantyExpiry,
             amount: 0, // Free with product
             status: 'Active',
             amountPaid: 0,
             paymentStatus: 'Paid'
           };
        });
        
        await customer.save();
      }
    } catch (syncError) {
      console.error("Failed to sync customer profile:", syncError);
      // Continue, don't block order response
    }

    res.status(201).json({ message: "Order placed", order });
  } catch (err) {
    console.error("placeOrder error:", err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ADMIN list
export const listOrders = async (_req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("items.product", "name slug");
    res.json({ orders });
  } catch (err) {
    console.error("listOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN get single
export const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate(
      "items.product",
      "name slug"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ order });
  } catch (err) {
    console.error("getOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN update status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();
    res.json({ message: "Order updated", order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// USER list
export const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate("items.product", "name slug mainImage");
    res.json({ orders });
  } catch (err) {
    console.error("getUserOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// controllers/userOrderController.js
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import RoPart from "../models/RoPart.js";
import Offer from "../models/Offer.js";
import User from "../models/User.js";
import UserAmc from "../models/UserAmc.js";
import InventoryLog from "../models/InventoryLog.js";

// Place Order
export const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod = "Online", offerCode, notes } = req.body;

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
        productImage: item.product.mainImage?.url || item.product.img || '',
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

    // Deduct stock for each ordered product
    for (const item of orderItems) {
      try {
        const product = await Product.findById(item.product);
        if (!product) continue;
        const previousStock = product.stock;
        const newStock = Math.max(0, previousStock - item.quantity);
        product.stock = newStock;
        await product.save();
        await InventoryLog.create({
          productId: product._id,
          change: -(item.quantity),
          previousStock,
          newStock,
          reason: 'Online Order',
          note: `Order #${order._id.toString().slice(-6).toUpperCase()} - ${item.productName}`
        });
      } catch (stockErr) {
        console.error('Stock deduction error:', stockErr.message);
      }
    }

    // ========== AUTO-ACTIVATE AMC PLANS & POPULATE ORDER DETAILS ==========
    try {
      console.log('🔄 Starting AMC auto-activation and order enrichment:', order._id);
      
      const updatedItems = [...order.items];
      let orderModified = false;

      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        
        // Generate a stable Warranty ID for every item
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        item.warrantyId = `WAR${timestamp}${random}`;
        item.warrantyExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
        orderModified = true;

        // Fetch full product/RO part details
        let productData = null;
        if (item.productType === 'RoPart') {
          productData = await RoPart.findById(item.product).populate('amcPlans');
        } else {
          productData = await Product.findById(item.product).populate('amcPlans');
        }
        
        if (!productData || !productData.amcPlans || productData.amcPlans.length === 0) continue;
        
        const activePlans = productData.amcPlans.filter(plan => plan && plan.isActive !== false);
        if (activePlans.length === 0) continue;
        
        // Use the first active plan for order item details
        const plan = activePlans[0];
        item.amcPlan = plan.name;
        
        // Generate AMC Ref (AMC ID)
        const amcRef = `AMC${timestamp}${Math.floor(Math.random() * 1000)}`;
        item.amcId = amcRef;

        // Create UserAmc entry for each active plan
        for (const p of activePlans) {
          const startDate = new Date();
          const endDate = new Date(Date.now() + (p.durationMonths || 12) * 30 * 24 * 60 * 60 * 1000);
          
          await UserAmc.create({
            userId: req.user.sub,
            orderId: order._id,
            productId: productData._id,
            productType: item.productType || 'Product',
            productName: productData.name,
            productImage: productData.mainImage?.url || productData.img || '',
            amcPlanId: p._id,
            amcPlanName: p.name,
            amcPlanPrice: p.price,
            durationMonths: p.durationMonths || 12,
            startDate,
            endDate,
            servicesTotal: p.servicesIncluded || 4,
            servicesUsed: 0,
            partsIncluded: p.partsIncluded || false,
            status: 'Active',
            paymentStatus: 'Paid',
            amountPaid: p.price,
            notes: `Auto-activated from order #${order._id}`,
            amcId: amcRef
          });
        }
      }
      
      if (orderModified) {
        order.items = updatedItems;
        await order.save();
      }
      
      console.log('✅ AMC auto-activation and order enrichment completed');
    } catch (amcError) {
      console.error('❌ AMC activation error:', amcError);
    }
    // ========== END AMC AUTO-ACTIVATION ==========

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

// Get User Orders - include phone-matched orders too
export const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.sub;

    // Get user phone for matching guest orders
    const user = await User.findById(userId).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    const orConditions = [
      { userId },
      ...(last10 ? [
        { 'shippingAddress.phone': user.phone },
        { 'shippingAddress.phone': { $regex: last10 + '$' } }
      ] : [])
    ];

    const filter = { $or: orConditions };
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate({ path: 'items.product', select: 'name slug mainImage p_id' })
        .lean(),
      Order.countDocuments(filter)
    ]);

    // Merge populated image into productImage if missing
    const ordersWithImages = orders.map(o => ({
      ...o,
      items: o.items.map(item => ({
        ...item,
        productImage: item.productImage || item.product?.mainImage?.url || item.product?.img || ''
      }))
    }));

    res.json({
      orders: ordersWithImages,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('getUserOrders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Single Order
export const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.sub;
    const user = await User.findById(userId).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    const orderDoc = await Order.findOne({
      _id: orderId,
      $or: [
        { userId },
        ...(last10 ? [
          { 'shippingAddress.phone': user.phone },
          { 'shippingAddress.phone': { $regex: last10 + '$' } }
        ] : [])
      ]
    }).populate({ path: 'items.product', select: 'name slug mainImage p_id' }).lean();

    if (!orderDoc) return res.status(404).json({ message: 'Order not found' });

    const order = {
      ...orderDoc,
      items: orderDoc.items.map(item => ({
        ...item,
        productImage: item.productImage || item.product?.mainImage?.url || item.product?.img || ''
      }))
    };

    res.json({ order });
  } catch (err) {
    console.error('getOrder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel Order
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub,
      source: { $ne: 'offline' }  // Prevent cancelling offline orders
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Allow cancellation only if pending
    if (order.status !== "pending") {
      return res.status(400).json({ message: "Order cannot be cancelled in current status" });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    await order.save();

    // Restore stock on cancellation
    for (const item of order.items) {
      try {
        const product = await Product.findById(item.product);
        if (!product) continue;
        const previousStock = product.stock;
        product.stock = previousStock + item.quantity;
        await product.save();
        await InventoryLog.create({
          productId: product._id,
          change: item.quantity,
          previousStock,
          newStock: product.stock,
          reason: 'Order Cancelled',
          note: `Order #${order._id.toString().slice(-6).toUpperCase()} cancelled by user`
        });
      } catch (stockErr) {
        console.error('Stock restore error:', stockErr.message);
      }
    }

    // Also cancel any auto-activated AMCs for this order
    await UserAmc.updateMany(
      { orderId: order._id },
      { $set: { status: 'Cancelled', notes: 'Order cancelled by user' } }
    );

    res.json({ message: "Order cancelled successfully", order });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Return Order
export const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub,
      source: { $ne: 'offline' }  // Prevent returning offline orders
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Allow return only if delivered
    if (order.status !== "delivered") {
      return res.status(400).json({ message: "Order can only be returned after delivery" });
    }

    order.status = "returned";
    await order.save();

    // Restore stock on return
    for (const item of order.items) {
      try {
        const product = await Product.findById(item.product);
        if (!product) continue;
        const previousStock = product.stock;
        product.stock = previousStock + item.quantity;
        await product.save();
        await InventoryLog.create({
          productId: product._id,
          change: item.quantity,
          previousStock,
          newStock: product.stock,
          reason: 'Order Returned',
          note: `Order #${order._id.toString().slice(-6).toUpperCase()} returned by user`
        });
      } catch (stockErr) {
        console.error('Stock restore error:', stockErr.message);
      }
    }

    // Also cancel any auto-activated AMCs for this order if product is returned
    await UserAmc.updateMany(
      { orderId: order._id },
      { $set: { status: 'Cancelled', notes: 'Product returned by user' } }
    );

    res.json({ message: "Order return initiated", order });
  } catch (err) {
    console.error("returnOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Track Order
export const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.user.sub,
      source: { $ne: 'offline' }  // Prevent tracking offline orders
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

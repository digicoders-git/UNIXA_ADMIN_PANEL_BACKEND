// controllers/orderController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import RoPart from "../models/RoPart.js";
import Offer from "../models/Offer.js";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import UserAmc from "../models/UserAmc.js";
import AmcPlan from "../models/AmcPlan.js";
import Transaction from "../models/Transaction.js";
import Lead from "../models/Lead.js";
import InventoryLog from "../models/InventoryLog.js";
import mongoose from "mongoose";

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

// PLACE ORDER (public + admin offline)
export const placeOrder = async (req, res) => {
  try {
    const {
      userId,
      items,
      shippingAddress,
      offerCode,
      paymentMethod,
      notes,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      source, // "offline" or undefined/"online"
      paymentStatus, // for manual offline
      status // for manual offline
    } = req.body;

    console.log("Place Order Attempt:", { source, userId, itemsCount: items?.length });
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    // Validation: userId NOT mandatory for offline
    if (source !== "offline" && !userId) {
      console.log("❌ Validation failed: userId required for online orders");
      return res.status(400).json({ message: "userId is required for online orders" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed: items invalid", { items });
      return res.status(400).json({ message: "items are required" });
    }
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone) {
      console.log("❌ Validation failed: shippingAddress invalid", { shippingAddress });
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

      // Stock check (only for Products, not RoParts)
      if (type === "Product" && itemData.stock !== undefined) {
        const qty = Number(item.quantity || 1);
        if (itemData.stock < qty) {
          return res.status(400).json({
            message: `"${itemData.name}" is out of stock or has insufficient stock.`
          });
        }
      }

      const qty = Number(item.quantity || 1);

      // Handle AMC Price addition if applicable so total is correct
      const amcPrice = Number(item.amcPrice || 0);
      const productPrice = itemData.finalPrice;
      const linePrice = (productPrice + amcPrice) * qty;

      subtotal += linePrice;

      itemsForOrder.push({
        product: itemData._id,
        productType: type, // Store the model type for refPath
        productName: itemData.name,
        productPrice: productPrice, // Base product price
        productImage: itemData.mainImage?.url || itemData.img || '',
        quantity: qty,
        size: item.size,
        color: item.color,
        addOnName: item.addOnName,
        // Generate Dynamic Warranty & AMC
        warrantyId: `WAR${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`,
        warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        amcId: item.amcId || (item.amcPlan ? `AMC${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}` : undefined),
        amcPlan: item.amcPlan,
        amcPlanName: item.amcPlanName,
        amcPrice: amcPrice // Store amc price per unit if needed
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
      userId: userId || null,
      items: itemsForOrder,
      subtotal,
      discount,
      total,
      offerCode: offer ? offer.code : undefined,
      paymentMethod: paymentMethod || "Online",
      paymentStatus: source === "offline" ? (paymentStatus || "paid") : (razorpay_payment_id ? "paid" : "pending"),
      status: source === "offline" ? (status || "confirmed") : "pending",
      shippingAddress,
      notes,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      source: source || "online"
    });

    // Deduct stock for Product type items
    for (const item of itemsForOrder) {
      if (item.productType !== 'Product') continue;
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
          reason: source === 'offline' ? 'Offline Order' : 'Online Order',
          note: `Order #${order._id.toString().slice(-6).toUpperCase()} - ${item.productName}`
        });
      } catch (stockErr) {
        console.error('Stock deduction error:', stockErr.message);
      }
    }

    // If offline order is created with delivered status, activate AMC immediately
    if (source === "offline" && (status === "delivered")) {
      try {
        let effectiveUserId = userId || null;
        if (!effectiveUserId && shippingAddress?.phone) {
          const userByPhone = await User.findOne({ phone: shippingAddress.phone }).select('_id');
          if (userByPhone) effectiveUserId = userByPhone._id;
        }
        for (const item of order.items) {
          if (!item.amcPlan) continue;
          const existingAmc = await UserAmc.findOne({ orderId: order._id, productId: item.product });
          if (existingAmc) continue;
          const selectedPlan = await AmcPlan.findById(item.amcPlan);
          if (!selectedPlan || !selectedPlan.isActive) continue;
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (selectedPlan.durationMonths || 12));
          await UserAmc.create({
            userId: effectiveUserId || null,
            orderId: order._id,
            customerPhone: shippingAddress?.phone || null,
            amcId: item.amcId || `AMC${Date.now()}${Math.floor(Math.random() * 1000)}`,
            productId: item.product,
            productType: item.productType || 'Product',
            productName: item.productName,
            productImage: item.productImage,
            amcPlanId: selectedPlan._id,
            amcPlanName: selectedPlan.name,
            amcPlanPrice: selectedPlan.price,
            durationMonths: selectedPlan.durationMonths || 12,
            startDate,
            endDate,
            servicesTotal: selectedPlan.servicesIncluded || 4,
            servicesUsed: 0,
            partsIncluded: selectedPlan.partsIncluded || false,
            status: 'Active',
            paymentStatus: 'Paid',
            amountPaid: item.amcPrice || selectedPlan.price
          });
          console.log(`✅ AMC activated on order create for ${item.productName}`);
        }
      } catch (amcErr) {
        console.error('❌ AMC activation on create failed:', amcErr.message);
      }
    }

    // Create Transaction Record
    try {
      // Get customer name from shippingAddress or User
      let customerName = shippingAddress.name || 'Guest';
      if (userId) {
        const user = await User.findById(userId).select('firstName lastName');
        if (user) {
          customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || customerName;
        }
      }

      await Transaction.create({
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: order._id,
        userId: userId || null,
        customerName,
        amount: total,
        status: order.paymentStatus === 'paid' ? 'success' : order.paymentStatus === 'failed' ? 'failed' : 'pending',
        paymentMethod: paymentMethod || 'COD',
        paymentGateway: razorpay_payment_id ? 'Razorpay' : (paymentMethod === 'Online' ? 'Online' : 'Manual'),
        description: `Order #${order._id.toString().slice(-6)} - ${itemsForOrder.map(i => i.productName).join(', ')}`,
        type: 'order',
        referenceId: order._id.toString()
      });
      console.log('✅ Transaction record created for order:', order._id);
    } catch (txnErr) {
      console.error('❌ Failed to create transaction record:', txnErr);
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

// BACKFILL - Create AMCs for existing delivered orders that missed AMC creation
export const backfillDeliveredOrderAmcs = async (req, res) => {
  try {
    const deliveredOrders = await Order.find({
      status: 'delivered',
      'items.amcPlan': { $exists: true, $ne: null }
    }).lean();

    let created = 0, skipped = 0;

    for (const order of deliveredOrders) {
      let effectiveUserId = order.userId;
      if (!effectiveUserId && order.shippingAddress?.phone) {
        const userByPhone = await User.findOne({ phone: order.shippingAddress.phone }).select('_id');
        if (userByPhone) effectiveUserId = userByPhone._id;
      }

      for (const item of order.items) {
        if (!item.amcPlan) continue;

        const existingAmc = await UserAmc.findOne({ orderId: order._id, productId: item.product });
        if (existingAmc) { skipped++; continue; }

        const selectedPlan = await AmcPlan.findById(item.amcPlan);
        if (!selectedPlan) { skipped++; continue; }

        const startDate = order.deliveredAt || order.updatedAt || order.createdAt;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + (selectedPlan.durationMonths || 12));

        await UserAmc.create({
          userId: effectiveUserId || null,
          orderId: order._id,
          customerPhone: order.shippingAddress?.phone || null,
          amcId: item.amcId || `AMC${Date.now()}${Math.floor(Math.random() * 1000)}`,
          productId: item.product,
          productType: item.productType || 'Product',
          productName: item.productName,
          productImage: item.productImage,
          amcPlanId: selectedPlan._id,
          amcPlanName: selectedPlan.name,
          amcPlanPrice: selectedPlan.price,
          durationMonths: selectedPlan.durationMonths || 12,
          startDate: new Date(startDate),
          endDate,
          servicesTotal: selectedPlan.servicesIncluded || 4,
          servicesUsed: 0,
          partsIncluded: selectedPlan.partsIncluded || false,
          status: 'Active',
          paymentStatus: 'Paid',
          amountPaid: item.amcPrice || selectedPlan.price
        });
        created++;
      }
    }

    res.json({ message: `Backfill complete`, created, skipped });
  } catch (err) {
    console.error('backfillDeliveredOrderAmcs error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ADMIN list
export const listOrders = async (_req, res) => {
  try {
    const orders = await Order.find()
      .select('_id status paymentStatus paymentMethod total shippingAddress createdAt items source')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    console.log('listOrders - Total orders found:', orders.length);
    const offlineOrders = orders.filter(o => o.source === 'offline');
    console.log('listOrders - Offline orders found:', offlineOrders.length);

    if (offlineOrders.length > 0) {
      console.log('listOrders - Sample offline order:', {
        id: offlineOrders[0]._id,
        source: offlineOrders[0].source,
        customerName: offlineOrders[0].shippingAddress?.name,
        total: offlineOrders[0].total
      });
    }

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

    const oldStatus = order.status;

    if (status) {
      order.status = status;
      if (status === 'confirmed' && !order.confirmedAt) order.confirmedAt = new Date();
      if (status === 'shipped' && !order.shippedAt) order.shippedAt = new Date();
      if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();
      if (status === 'cancelled' && !order.cancelledAt) order.cancelledAt = new Date();
    }
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();

    // Auto-create UserAMC when order is delivered
    if (status === 'delivered' && oldStatus !== 'delivered') {
      try {
        // Try to find registered user by phone (for offline orders where userId may be null)
        let effectiveUserId = order.userId;
        if (!effectiveUserId && order.shippingAddress?.phone) {
          const userByPhone = await User.findOne({ phone: order.shippingAddress.phone }).select('_id');
          if (userByPhone) effectiveUserId = userByPhone._id;
        }

        for (const item of order.items) {
          // Skip if no AMC plan was selected for this item
          if (!item.amcPlan) continue;

          // Skip if AMC already exists for this order+product combo
          const existingAmc = await UserAmc.findOne({ orderId: order._id, productId: item.product });
          if (existingAmc) continue;

          const selectedPlan = await AmcPlan.findById(item.amcPlan);
          if (!selectedPlan || !selectedPlan.isActive) continue;

          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (selectedPlan.durationMonths || 12));

          await UserAmc.create({
            userId: effectiveUserId || null,
            orderId: order._id,
            customerPhone: order.shippingAddress?.phone || null,
            amcId: item.amcId || `AMC${Date.now()}${Math.floor(Math.random() * 1000)}`,
            productId: item.product,
            productType: item.productType || 'Product',
            productName: item.productName,
            productImage: item.productImage,
            amcPlanId: selectedPlan._id,
            amcPlanName: selectedPlan.name,
            amcPlanPrice: selectedPlan.price,
            durationMonths: selectedPlan.durationMonths || 12,
            startDate,
            endDate,
            servicesTotal: selectedPlan.servicesIncluded || 4,
            servicesUsed: 0,
            partsIncluded: selectedPlan.partsIncluded || false,
            status: 'Active',
            paymentStatus: 'Paid',
            amountPaid: item.amcPrice || selectedPlan.price
          });

          console.log(`✅ AMC activated for ${item.productName} (order: ${order._id})`);
        }
      } catch (amcErr) {
        console.error('❌ Error activating AMC:', amcErr.message);
      }
    }

    res.json({ message: "Order updated", order });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN delete order
export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Optional: Add logic to restrict deletion of completed orders

    await Order.findByIdAndDelete(orderId);
    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("deleteOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN Update Order Details (For Offline Orders Editing)
export const updateOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updates = req.body; // Expecting shippingAddress, paymentStatus, etc.

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Update fields safely
    if (updates.shippingAddress) {
      order.shippingAddress = { ...order.shippingAddress, ...updates.shippingAddress };
    }
    if (updates.paymentMethod) order.paymentMethod = updates.paymentMethod;
    if (updates.paymentStatus) order.paymentStatus = updates.paymentStatus;
    if (updates.status) order.status = updates.status;

    // Recalculating items is complex, for simple edit usually we block item changes 
    // OR we'd need to re-run the item validation logic as in placeOrder. 
    // For MVP, letting admins edit customer details and status is safer.

    await order.save();
    res.json({ message: "Order details updated", order });
  } catch (err) {
    console.error("updateOrderDetails error:", err);
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

// GET CUSTOMERS FROM ORDERS
export const getCustomersFromOrders = async (req, res) => {
  try {
    const { search } = req.query;

    const [orders, leads, actualCustomers] = await Promise.all([
      Order.find().sort({ createdAt: -1 }),
      Lead.find().sort({ createdAt: -1 }),
      Customer.find().lean()
    ]);

    // Extract unique customers based on phone number
    const customerMap = new Map();

    // Process Actual Customers first (highest authority)
    actualCustomers.forEach(cust => {
      const phone = cust.mobile;
      if (!phone) return;

      customerMap.set(phone, {
        ...cust,
        _id: cust._id,
        phone: phone,
        mobile: phone,
        type: cust.type || "Existing",
        source: cust.source || "Manual",
        status: cust.status || "Active",
        orderItems: [],
        orderCount: 0,
        amcCount: 0,
        actualCustomer: true,
        createdAt: cust.createdAt
      });
    });

    // Process Orders
    orders.forEach(order => {
      const phone = order.shippingAddress?.phone;
      if (!phone) return;

      if (!customerMap.has(phone)) {
        customerMap.set(phone, {
          _id: phone,
          phone: phone,
          name: order.shippingAddress.name,
          mobile: phone,
          email: order.shippingAddress.email || '',
          address: {
            house: order.shippingAddress.addressLine1 || '',
            area: order.shippingAddress.addressLine2 || '',
            city: order.shippingAddress.city || '',
            pincode: order.shippingAddress.pincode || '',
          },
          type: 'Order Customer',
          source: order.source || 'Online',
          status: 'Active',
          orderItems: [],
          orderCount: 0,
          serviceHistory: [],
          createdAt: order.createdAt
        });
      }

      const customer = customerMap.get(phone);

      // If actual customer has empty address, fill from order's shippingAddress
      if (customer.actualCustomer) {
        const addr = customer.address || {};
        if (!addr.house && !addr.area && !addr.city && !addr.pincode) {
          customer.address = {
            house: order.shippingAddress.addressLine1 || '',
            area: order.shippingAddress.addressLine2 || '',
            city: order.shippingAddress.city || '',
            pincode: order.shippingAddress.pincode || '',
          };
        }
      }

      customer.orderCount += 1;
      order.items.forEach(item => {
        customer.orderItems.push({
          productName: item.productName,
          orderId: order._id,
          date: order.createdAt
        });
      });
    });

    // Process Leads
    leads.forEach(lead => {
      const phone = lead.phone;
      if (!phone) return;

      if (!customerMap.has(phone)) {
        customerMap.set(phone, {
          _id: phone,
          phone: phone,
          name: lead.name,
          mobile: phone,
          email: lead.email || '',
          address: {
            house: '',
            area: lead.address || '',
            city: '',
            pincode: '',
          },
          type: 'Lead',
          source: lead.source || 'Lead',
          status: lead.status === 'Completed' ? 'Active' : 'Pending',
          orderItems: [],
          orderCount: 0,
          serviceHistory: [],
          createdAt: lead.createdAt
        });
      } else {
        const customer = customerMap.get(phone);
        if (customer.type === 'Order Customer' || customer.actualCustomer) {
          customer.isAlsoLead = true;
          customer.leadId = lead._id;
          if (!customer.source) customer.source = lead.source;
        }
      }
    });

    // Fetch all User AMCs to count them
    const allUserAmcs = await UserAmc.find().lean();
    const allUsers = await User.find().select('phone _id').lean();
    const phoneToUserId = new Map();
    allUsers.forEach(u => {
      if (u.phone) {
        // Normalize phone to last 10 digits for matching
        const suffix = u.phone.slice(-10);
        phoneToUserId.set(suffix, u._id.toString());
      }
    });

    let customers = Array.from(customerMap.values());

    // Map counts to customers
    customers.forEach(customer => {
      const phoneSuffix = (customer.mobile || "").replace(/\D/g, '').slice(-10);
      const userId = phoneToUserId.get(phoneSuffix);

      // Count AMCs for this customer by phone suffix OR userId
      const customerAmcs = allUserAmcs.filter(amc => {
        const amcPhone = amc.customerPhone || "";
        const amcPhoneSuffix = amcPhone.replace(/\D/g, '').slice(-10);
        return amcPhoneSuffix === phoneSuffix || (userId && amc.userId?.toString() === userId);
      });

      let amcCount = customerAmcs.length;
      
      // If it's an actual customer and has a manual plan name set, add it if not already in UserAmc
      if (customer.amcDetails && customer.amcDetails.planName && customer.amcDetails.status !== 'Not Taken') {
        // Only count if it's not already covered by UserAmc (UserAmc usually uses a mongo ObjectID for orderId)
        // But for simplicity, let's just make sure it's counted if there are no UserAmcs or if we want to be safe
        // Actually, if we use consolidated counts, it's better.
        // Let's just check if it was missing.
        const path = customer.amcDetails;
        if (path.planName) amcCount = Math.max(amcCount, 1); // If manual exists, at least 1
      }
      
      customer.amcCount = amcCount;
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.mobile?.includes(search) ||
        c.email?.toLowerCase().includes(searchLower)
      );
    }

    res.json(customers);
  } catch (err) {
    console.error("getCustomersFromOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// controllers/userAmcController.js
import UserAmc from "../models/UserAmc.js";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import AdminNotification from "../models/AdminNotification.js";
import ServiceRequest from "../models/ServiceRequest.js";
import AssignedTicket from "../models/AssignedTicket.js";

// Get user AMC history by phone number (Admin)
export const getUserAmcHistoryByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    // Clean phone number to get last 10 digits for robust matching
    const last10 = phone.replace(/\D/g, '').slice(-10);
    
    // 1. Find User (if exists)
    const user = await User.findOne({ 
      $or: [
        { phone },
        { phone: { $regex: last10 + '$' } }
      ]
    }).select('_id firstName lastName phone email').lean();

    // 2. Build AMC query
    const amcQuery = {
      $or: [
        { customerPhone: phone },
        { customerPhone: { $regex: last10 + '$' } }
      ]
    };
    
    if (user) {
      amcQuery.$or.push({ userId: user._id });
    }

    // 3. Get all AMCs
    const amcs = await UserAmc.find(amcQuery)
      .populate('amcPlanId', 'name')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (amcs.length === 0 && !user) {
      return res.status(404).json({ message: "No records found for this phone number" });
    }

    // 4. Construct response
    // Use user data if found, otherwise use data from the first AMC record
    const responseUser = user || {
      _id: null,
      firstName: amcs[0]?.customerPhone || phone,
      lastName: '(Guest)',
      phone: phone,
      email: ''
    };

    res.json({
      user: responseUser,
      amcs: amcs.map(amc => ({
        _id: amc._id,
        productName: amc.productName,
        amcPlanName: amc.amcPlanName,
        amcPlanPrice: amc.amcPlanPrice,
        startDate: amc.startDate,
        endDate: amc.endDate,
        status: amc.status,
        servicesTotal: amc.servicesTotal || 4,
        servicesUsed: amc.servicesUsed || 0,
        createdAt: amc.createdAt
      }))
    });
  } catch (err) {
    console.error("getUserAmcHistoryByPhone error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all user AMCs (Admin)
export const getAllUserAmcs = async (req, res) => {
  try {
    const amcs = await UserAmc.find()
      .populate('userId', 'firstName lastName phone email addresses')
      .populate('amcPlanId', 'name')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Collect all offline phones in one go
    const offlinePhones = [...new Set(amcs.filter(a => !a.userId && a.customerPhone).map(a => a.customerPhone))];
    
    // Single query for all offline orders
    const offlineOrders = offlinePhones.length > 0
      ? await Order.find({ 'shippingAddress.phone': { $in: offlinePhones } }).select('shippingAddress').lean()
      : [];

    const orderMap = {};
    offlineOrders.forEach(o => { orderMap[o.shippingAddress.phone] = o; });

    const now = new Date();
    const amcsWithExtras = amcs.map(amc => {
      const end = new Date(amc.endDate);
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      const obj = { ...amc, servicesRemaining: amc.servicesTotal - amc.servicesUsed, daysRemaining };

      if (!obj.userId && obj.customerPhone) {
        const order = orderMap[obj.customerPhone];
        if (order?.shippingAddress?.name) {
          const parts = order.shippingAddress.name.split(' ');
          obj.userId = {
            firstName: parts[0],
            lastName: parts.slice(1).join(' ') || '',
            phone: obj.customerPhone,
            email: order.shippingAddress.email || ''
          };
        } else {
          obj.userId = { firstName: 'Offline', lastName: 'Customer', phone: obj.customerPhone };
        }
      }
      return obj;
    });

    res.json({ amcs: amcsWithExtras });
  } catch (err) {
    console.error("getAllUserAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all active AMCs for logged-in user
export const getMyAmcs = async (req, res) => {
  try {
    const { status = 'Active', page = 1, limit = 10 } = req.query;

    const user = await User.findById(req.user.sub).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    // Build $or conditions: userId OR phone
    const orConditions = [{ userId: req.user.sub }];
    if (last10) {
      orConditions.push({ customerPhone: user.phone });
      orConditions.push({ customerPhone: { $regex: last10 + '$' } });
    }

    // Link phone-matched AMCs to this userId (one-time fix)
    if (last10) {
      await UserAmc.updateMany(
        { $or: [{ customerPhone: user.phone }, { customerPhone: { $regex: last10 + '$' } }], userId: null },
        { $set: { userId: req.user.sub } }
      );
    }

    const filter = { $or: orConditions };
    if (status && status !== 'all') filter.status = status;

    const amcs = await UserAmc.find(filter)
      .populate('amcPlanId', 'name features color isPopular')
      .populate('productId', 'name mainImage img')
      .populate('orderId', '_id createdAt status')
      .sort({ endDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserAmc.countDocuments(filter);

    const amcsWithExtras = amcs.map(amc => {
      const amcObj = amc.toObject({ virtuals: true });
      const now = new Date();
      const end = new Date(amc.endDate);
      const start = new Date(amc.startDate);
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
      const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
      return { ...amcObj, daysRemaining, progressPercent: Math.round(progressPercent), servicesRemaining: amc.servicesTotal - amc.servicesUsed };
    });

    res.json({
      amcs: amcsWithExtras,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('getMyAmcs error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single AMC details
export const getAmcDetails = async (req, res) => {
  try {
    const { amcId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(amcId)) {
      return res.status(400).json({ message: "Invalid AMC ID" });
    }

    const amc = await UserAmc.findOne({
      _id: amcId,
      userId: req.user.sub
    })
      .populate('amcPlanId')
      .populate('orderId', 'createdAt status paymentStatus');

    if (!amc) {
      return res.status(404).json({ message: "AMC not found" });
    }

    // Add computed fields
    const now = new Date();
    const end = new Date(amc.endDate);
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    const start = new Date(amc.startDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
    const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

    const amcObj = amc.toObject({ virtuals: true });

    res.json({
      amc: {
        ...amcObj,
        daysRemaining,
        progressPercent: Math.round(progressPercent),
        servicesRemaining: amc.servicesTotal - amc.servicesUsed
      }
    });
  } catch (err) {
    console.error("getAmcDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get AMC statistics/summary
export const getAmcSummary = async (req, res) => {
  try {
    const userId = req.user.sub;
    const user = await User.findById(userId).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    const orConditions = [
      { userId: new mongoose.Types.ObjectId(userId) },
      ...(last10 ? [{ customerPhone: { $regex: last10 + '$' } }] : [])
    ];

    const [activeCount, expiredCount, totalServices, upcomingExpiry] = await Promise.all([
      UserAmc.countDocuments({ $or: orConditions, status: 'Active' }),
      UserAmc.countDocuments({ $or: orConditions, status: 'Expired' }),
      UserAmc.aggregate([
        { $match: { $or: orConditions } },
        { $group: { _id: null, total: { $sum: '$servicesUsed' } } }
      ]),
      UserAmc.find({
        $or: orConditions,
        status: 'Active',
        endDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
      }).select('productName endDate').sort({ endDate: 1 }).limit(5)
    ]);

    res.json({
      summary: {
        activeAmcs: activeCount,
        expiredAmcs: expiredCount,
        totalServicesUsed: totalServices[0]?.total || 0,
        upcomingExpiry: upcomingExpiry.map(amc => ({
          productName: amc.productName,
          expiryDate: amc.endDate,
          daysRemaining: Math.ceil((new Date(amc.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        }))
      }
    });
  } catch (err) {
    console.error('getAmcSummary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Request service visit (add to service history)
export const requestService = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { notes } = req.body;

    const amc = await UserAmc.findOne({
      _id: amcId,
      $or: [{ userId: req.user.sub }, { customerPhone: { $exists: true } }],
      status: 'Active'
    }).populate('userId');

    if (!amc) {
      return res.status(404).json({ message: "Active AMC not found" });
    }

    if (amc.servicesUsed >= amc.servicesTotal) {
      return res.status(400).json({
        message: "All service visits have been used. Please renew your AMC."
      });
    }

    const count = await ServiceRequest.countDocuments();
    const ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;

    const user = amc.userId;
    const userName = user ? `${user.firstName} ${user.lastName}` : (amc.customerPhone || 'Customer');
    const userPhone = user?.phone || amc.customerPhone || '';
    const userEmail = user?.email || '';
    const description = `AMC Service Request\nProduct: ${amc.productName}\nAMC ID: ${amc.amcId}\nNotes: ${notes || 'Service requested by customer'}`;

    await ServiceRequest.create({
      ticketId,
      userId: user?._id || null,
      amcId: amc._id,
      customerName: userName,
      customerPhone: userPhone,
      customerEmail: userEmail,
      type: 'AMC Service',
      description,
      priority: 'Medium',
      status: 'Open'
    });

    amc.serviceHistory.push({
      date: new Date(),
      type: 'Regular Service',
      notes: notes || 'Service requested by customer',
      technicianName: 'Pending Assignment',
      complaintId: ticketId
    });

    await amc.save();

    await AdminNotification.create({
      title: "New AMC Service Request",
      message: `Service request for ${amc.productName} - AMC ID: ${amc.amcId}`,
      type: "ServiceRequest",
      refId: ticketId
    });

    res.json({
      message: "Service request submitted successfully",
      complaintId: ticketId,
      servicesRemaining: amc.servicesTotal - amc.servicesUsed
    });
  } catch (err) {
    console.error("requestService error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get AMCs due for service (every 4 months)
export const getDueAmcs = async (req, res) => {
  try {
    const [amcs, openAmcTickets] = await Promise.all([
      UserAmc.find({ status: 'Active' })
        .populate('userId', 'firstName lastName phone email addresses')
        .populate('amcPlanId', 'name')
        .lean(),
      AssignedTicket.find({
        amcId: { $exists: true },
        status: { $in: ['Pending', 'In Progress'] }
      }).select('amcId').lean()
    ]);

    const openAmcIds = new Set(openAmcTickets.map(t => t.amcId.toString()));
    const now = new Date();
    const fifteenDaysLater = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const dueAmcs = amcs.filter(amc => {
      if (openAmcIds.has(amc._id.toString())) return false;
      if (amc.servicesUsed >= amc.servicesTotal) return false;
      const dueDate = amc.nextServiceDueDate
        ? new Date(amc.nextServiceDueDate)
        : (() => { const d = new Date(amc.startDate); d.setMonth(d.getMonth() + (amc.servicesUsed + 1) * 4); return d; })();
      return dueDate <= fifteenDaysLater;
    }).map(amc => {
      const dueDate = amc.nextServiceDueDate
        ? new Date(amc.nextServiceDueDate)
        : (() => { const d = new Date(amc.startDate); d.setMonth(d.getMonth() + (amc.servicesUsed + 1) * 4); return d; })();
      return { ...amc, nextServiceDueDate: dueDate, nextServiceNumber: amc.servicesUsed + 1 };
    });

    res.json({ amcs: dueAmcs });
  } catch (err) {
    console.error("getDueAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Cancel AMC
export const cancelAmc = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { reason } = req.body;

    const amc = await UserAmc.findOne({
      _id: amcId,
      userId: req.user.sub
    });

    if (!amc) {
      return res.status(404).json({ message: "AMC not found" });
    }

    if (amc.status === 'Cancelled') {
      return res.status(400).json({ message: "AMC is already cancelled" });
    }

    if (amc.status === 'Expired') {
      return res.status(400).json({ message: "Cannot cancel an expired AMC" });
    }

    amc.status = 'Cancelled';
    amc.notes = `${amc.notes || ''}\nCancelled by user. Reason: ${reason || 'Not specified'}`;
    await amc.save();

    res.json({
      message: "AMC cancelled successfully",
      amc
    });
  } catch (err) {
    console.error("cancelAmc error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// Admin: Manually Renew an AMC (Creates a NEW record to preserve history)
export const renewAmc = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { startDate, endDate, durationMonths, servicesTotal, pricePaid } = req.body;

    const oldAmc = await UserAmc.findById(amcId);
    if (!oldAmc) {
      return res.status(404).json({ message: "AMC not found" });
    }

    // Mark old AMC as Renewed
    oldAmc.status = 'Renewed';
    oldAmc.notes = `${oldAmc.notes || ''}\n[RENEWED - Renewed on ${new Date().toLocaleDateString()}]`.trim();
    await oldAmc.save();

    const start = startDate ? new Date(startDate) : new Date();
    let end;
    if (endDate) {
      end = new Date(endDate);
    } else {
      end = new Date(start);
      const monthsToAdd = durationMonths || 12;
      end.setMonth(end.getMonth() + monthsToAdd);
    }

    // Create a NEW AMC record to preserve the old (expired) one's history
    const newAmcData = {
      userId: oldAmc.userId,
      orderId: oldAmc.orderId,
      productId: oldAmc.productId,
      productType: oldAmc.productType,
      productName: oldAmc.productName,
      productImage: oldAmc.productImage,
      amcPlanId: oldAmc.amcPlanId,
      amcPlanName: oldAmc.amcPlanName,
      amcPlanPrice: pricePaid || oldAmc.amcPlanPrice,
      durationMonths: durationMonths || oldAmc.durationMonths || 12,
      startDate: start,
      endDate: end,
      servicesTotal: servicesTotal || oldAmc.servicesTotal || 4,
      servicesUsed: 0,
      status: 'Active',
      amountPaid: pricePaid || oldAmc.amcPlanPrice || 0,
      paymentStatus: 'Paid',
      notes: `Renewed from previous AMC ID: ${oldAmc._id}. Manual renewal by Admin.`,
      serviceHistory: [{
        date: new Date(),
        type: 'Other',
        technicianName: 'System Admin',
        notes: `New subscription period started via manual renewal. Previous period (ID: ${oldAmc._id}) was ${oldAmc.status}.`,
      }]
    };

    const newAmc = await UserAmc.create(newAmcData);

    // Update old AMC to reference new one
    oldAmc.notes = `${oldAmc.notes || ''}\n[RENEWED into new ID: ${newAmc._id}]`.trim();
    await oldAmc.save();

    // Send Notification to User
    try {
      const UserNotification = mongoose.model('UserNotification');
      await UserNotification.create({
        userId: newAmc.userId,
        title: 'AMC Subscription Renewed',
        message: `Your AMC for ${newAmc.productName} has been renewed! A new subscription period has started, valid until ${end.toLocaleDateString()}.`,
        type: 'AMC'
      });
    } catch (notifErr) {
      console.error("Failed to send renewal notification:", notifErr);
    }

    res.json({
      message: "AMC renewed successfully. New record created.",
      amc: newAmc
    });
  } catch (err) {
    console.error("renewAmc error:", err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};

// Admin: Create a NEW AMC record manually (for products that don't have one)
export const createManualAmc = async (req, res) => {
  try {
    const { 
      userId, 
      orderId, 
      productId, 
      productType, 
      productName, 
      productImage,
      amcPlanId,
      amcPlanName,
      amcPlanPrice,
      durationMonths,
      servicesTotal,
      startDate,
      customerPhone
    } = req.body;

    if (!productId || !amcPlanId) {
      return res.status(400).json({ message: "Missing required fields (productId, amcPlanId)" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    const monthsToAdd = (durationMonths !== undefined && durationMonths !== null) ? parseInt(durationMonths) : 12;
    end.setMonth(end.getMonth() + monthsToAdd);

    const newAmc = await UserAmc.create({
      userId: userId || null,
      orderId: orderId || null,
      customerPhone: customerPhone || null,
      productId,
      productType: productType || 'Product',
      productName,
      productImage,
      amcPlanId,
      amcPlanName,
      amcPlanPrice,
      durationMonths: monthsToAdd,
      startDate: start,
      endDate: end,
      servicesTotal: (servicesTotal !== undefined && servicesTotal !== null) ? parseInt(servicesTotal) : 4,
      servicesUsed: 0,
      status: 'Active',
      amountPaid: amcPlanPrice || 0,
      paymentStatus: 'Paid',
      notes: `Manually created by Admin.`,
      serviceHistory: [{
        date: new Date(),
        type: 'Other',
        technicianName: 'System Admin',
        notes: `Manual AMC subscription started.`,
      }]
    });

    res.status(201).json({
      message: "AMC created successfully",
      amc: newAmc
    });
  } catch (err) {
    console.error("createManualAmc error:", err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};

// Get products eligible for AMC (from user's previous orders)
export const getEligibleProducts = async (req, res) => {
  try {
    const userId = req.user.sub;

    // Get user's phone for matching guest orders
    const user = await User.findById(userId).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    // Build order query — match by userId OR phone
    const orderQuery = {
      status: { $in: ['delivered', 'installed'] },
      $or: [{ userId }]
    };
    if (last10) {
      orderQuery.$or.push({ 'shippingAddress.phone': user.phone });
      orderQuery.$or.push({ 'shippingAddress.phone': { $regex: last10 + '$' } });
    }

    const orders = await Order.find(orderQuery).populate('items.product').lean();

    // Extract unique products
    const productsMap = new Map();
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product) continue;
        const key = item.product._id.toString();
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            _id: item.product._id,
            name: item.product.name || item.productName,
            image: item.product.mainImage?.url || item.product.img || '',
            orderId: order._id,
            purchaseDate: order.createdAt,
            deliveredAt: order.deliveredAt,
            address: order.shippingAddress,
            productType: item.productType || 'Product'
          });
        }
      }
    }

    // Also include products from productName in orders (when product ref is missing)
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product) continue; // already handled
        if (!item.productName) continue;
        const key = item.productName;
        if (!productsMap.has(key)) {
          productsMap.set(key, {
            _id: item.product || null,
            name: item.productName,
            image: item.productImage || '',
            orderId: order._id,
            purchaseDate: order.createdAt,
            deliveredAt: order.deliveredAt,
            address: order.shippingAddress,
            productType: item.productType || 'Product'
          });
        }
      }
    }

    // Mark which products already have active AMC
    const activeAmcs = await UserAmc.find({
      $or: [{ userId }, ...(last10 ? [{ customerPhone: { $regex: last10 + '$' } }] : [])],
      status: 'Active'
    }).lean();

    const products = Array.from(productsMap.values()).map(product => {
      const existingAmc = activeAmcs.find(amc =>
        amc.productId?.toString() === product._id?.toString() ||
        amc.productName === product.name
      );
      return { ...product, hasActiveAmc: !!existingAmc, amcId: existingAmc?._id || null };
    });

    res.json({ products });
  } catch (err) {
    console.error('getEligibleProducts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

import User from "../models/User.js";
import AdminNotification from "../models/AdminNotification.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Order from "../models/Order.js";
import UserAmc from "../models/UserAmc.js";

export const getUserItemsForComplaint = async (req, res) => {
  try {
    const userId = req.user.sub;

    const user = await User.findById(userId).select('phone').lean();
    const last10 = user?.phone?.replace(/\D/g, '').slice(-10);

    const orderFilter = {
      status: { $nin: ['cancelled'] },
      $or: [
        { userId },
        ...(last10 ? [
          { 'shippingAddress.phone': user.phone },
          { 'shippingAddress.phone': { $regex: last10 + '$' } }
        ] : [])
      ]
    };

    const [orders, amcs] = await Promise.all([
      Order.find(orderFilter)
        .select('_id items.productName items.productImage createdAt status')
        .sort({ createdAt: -1 }).limit(20).lean(),
      UserAmc.find({
        status: 'Active',
        $or: [
          { userId },
          ...(last10 ? [{ customerPhone: { $regex: last10 + '$' } }] : [])
        ]
      }).select('_id productName amcPlanName startDate').lean()
    ]);

    const items = [
      ...orders.map(o => ({
        id: o._id,
        type: 'Order',
        name: o.items.map(i => i.productName).join(', '),
        label: `Order #${String(o._id).slice(-6).toUpperCase()} - ${o.items.map(i => i.productName).join(', ')}`,
        status: o.status,
        date: o.createdAt
      })),
      ...amcs.map(a => ({
        id: a._id,
        type: 'AMC',
        name: `${a.productName} (${a.amcPlanName})`,
        label: `AMC - ${a.productName} (${a.amcPlanName})`,
        date: a.startDate
      }))
    ];

    res.json({ items });
  } catch (err) {
    console.error('getUserItemsForComplaint error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createServiceRequest = async (req, res) => {
  try {
    const { type, description, date, priority, relatedItemType, relatedItemId, relatedItemName } = req.body;

    if (!type || !description) {
      return res.status(400).json({ message: "Type and description are required" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const primaryAddress = user.addresses && user.addresses.length > 0 
      ? user.addresses.find(addr => addr.isDefault || addr.isPrimary) || user.addresses[0]
      : null;
    
    const addressString = primaryAddress 
      ? `${primaryAddress.addressLine1 || ''}, ${primaryAddress.city || ''}, ${primaryAddress.state || ''} ${primaryAddress.pincode || ''}`.trim()
      : 'N/A';

    const count = await ServiceRequest.countDocuments();
    const ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;

    const newRequest = await ServiceRequest.create({
      ticketId,
      userId: user._id,
      customerName: `${user.firstName} ${user.lastName}`,
      customerPhone: user.phone,
      customerEmail: user.email,
      address: addressString,
      type,
      description,
      date: date || new Date(),
      priority: priority || "Medium",
      status: "Open",
      relatedItemType: relatedItemType || "General",
      relatedItemId: relatedItemId || null,
      relatedItemName: relatedItemName || null
    });

    await AdminNotification.create({
      title: "New Service Request",
      message: `${user.firstName} ${user.lastName} submitted a ${type} request - ${ticketId}`,
      type: "ServiceRequest",
      refId: ticketId
    });

    res.status(201).json({ 
      message: "Service request submitted successfully", 
      request: newRequest 
    });
  } catch (err) {
    console.error("createServiceRequest error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({ userId: req.user.sub })
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    console.error("getUserServiceRequests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

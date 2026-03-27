import AmcEnquiry from "../models/AmcEnquiry.js";
import UserAmc from "../models/UserAmc.js";
import User from "../models/User.js";
import AdminNotification from "../models/AdminNotification.js";
import mongoose from "mongoose";

// User/Website: Create AMC enquiry
export const createAmcEnquiry = async (req, res) => {
  try {
    const { amcPlanName, amcPlanId, productName, productId, duration, price, notes, source, name, phone, email, address } = req.body;

    let customerName = name;
    let customerPhone = phone;
    let customerEmail = email;
    let userId = null;

    if (req.user?.sub) {
      const user = await User.findById(req.user.sub).select("firstName lastName phone email").lean();
      if (user) {
        customerName = customerName || `${user.firstName} ${user.lastName}`;
        customerPhone = customerPhone || user.phone;
        customerEmail = customerEmail || user.email;
        userId = user._id;
      }
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const enquiry = await AmcEnquiry.create({
      name: customerName, phone: customerPhone, email: customerEmail, address,
      userId, amcPlanId, amcPlanName, productName, productId, duration, price,
      notes, source: source || "website",
    });

    await AdminNotification.create({
      title: "New AMC Booking Request",
      message: `${customerName} (${customerPhone}) requested ${amcPlanName}${productName ? ` for ${productName}` : ""}`,
      type: "Enquiry",
      refId: enquiry._id.toString(),
    });

    res.status(201).json({ success: true, message: "AMC request submitted", enquiry });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Admin: List all enquiries
export const listEnquiries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== "All" ? { status } : {};
    const enquiries = await AmcEnquiry.find(filter)
      .populate("userId", "firstName lastName phone email")
      .populate("amcPlanId", "name productConfigs servicesIncluded partsIncluded")
      .sort({ createdAt: -1 });
    res.json({ success: true, enquiries });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Get customer order history by phone
export const getCustomerOrdersByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const Order = (await import('../models/Order.js')).default;

    const user = await User.findOne({
      $or: [{ phone }, { phone: { $regex: last10 + '$' } }]
    }).select('firstName lastName phone email').lean();

    const orders = await Order.find({
      $or: [
        { 'shippingAddress.phone': phone },
        { 'shippingAddress.phone': { $regex: last10 + '$' } },
        ...(user ? [{ userId: user._id }] : [])
      ],
      status: { $in: ['delivered', 'installed'] }
    }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, user, orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Public: Get delivered orders by phone (for website AMC booking)
export const getOrdersByPhonePublic = async (req, res) => {
  try {
    const { phone } = req.params;
    const last10 = phone.replace(/\D/g, '').slice(-10);
    const Order = (await import('../models/Order.js')).default;

    const orders = await Order.find({
      $or: [
        { 'shippingAddress.phone': phone },
        { 'shippingAddress.phone': { $regex: last10 + '$' } }
      ],
      status: { $in: ['delivered', 'installed'] }
    }).select('items shippingAddress createdAt deliveredAt status total').sort({ createdAt: -1 }).lean();

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Verify enquiry
export const verifyEnquiry = async (req, res) => {
  try {
    const enq = await AmcEnquiry.findByIdAndUpdate(req.params.id, { status: "Verified", adminNotes: req.body.adminNotes }, { new: true });
    if (!enq) return res.status(404).json({ message: "Not found" });
    res.json({ success: true, enquiry: enq });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Reject enquiry
export const rejectEnquiry = async (req, res) => {
  try {
    const enq = await AmcEnquiry.findByIdAndUpdate(req.params.id, { status: "Rejected", adminNotes: req.body.adminNotes }, { new: true });
    if (!enq) return res.status(404).json({ message: "Not found" });
    res.json({ success: true, enquiry: enq });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Activate AMC from enquiry
export const activateAmcFromEnquiry = async (req, res) => {
  try {
    const enq = await AmcEnquiry.findById(req.params.id).populate("amcPlanId");
    if (!enq) return res.status(404).json({ message: "Enquiry not found" });

    const { startDate, durationMonths, servicesTotal, amountPaid, paymentMode, paymentStatus, productId, productName, productType, userId, customerPhone } = req.body;

    const start = new Date(startDate || Date.now());
    const end = new Date(start);
    end.setMonth(end.getMonth() + (parseInt(durationMonths) || 12));

    const amc = await UserAmc.create({
      userId: userId || enq.userId || null,
      customerPhone: customerPhone || enq.phone,
      productId: productId || enq.productId || enq.amcPlanId?.productConfigs?.[0]?.productId || new mongoose.Types.ObjectId(),
      productType: productType || "Product",
      productName: productName || enq.productName || "Product",
      amcPlanId: enq.amcPlanId?._id || enq.amcPlanId,
      amcPlanName: enq.amcPlanName,
      amcPlanPrice: amountPaid || enq.price || 0,
      durationMonths: parseInt(durationMonths) || 12,
      startDate: start,
      endDate: end,
      servicesTotal: parseInt(servicesTotal) || enq.amcPlanId?.servicesIncluded || 4,
      servicesUsed: 0,
      status: "Active",
      amountPaid: amountPaid || 0,
      paymentStatus: paymentStatus || "Paid",
      partsIncluded: enq.amcPlanId?.partsIncluded || false,
      notes: `Created from AMC enquiry #${enq._id}. Payment: ${paymentMode || "Cash"}.`,
      serviceHistory: [{ date: new Date(), type: "Other", technicianName: "Admin", notes: "AMC activated by admin from enquiry." }],
    });

    await AmcEnquiry.findByIdAndUpdate(req.params.id, { status: "Activated", activatedAmcId: amc._id, amountPaid, paymentMode, paymentStatus });

    if (amc.userId) {
      try {
        const UserNotification = (await import("../models/UserNotification.js")).default;
        await UserNotification.create({
          userId: amc.userId,
          title: "AMC Activated!",
          message: `Your AMC for ${amc.productName} (${enq.amcPlanName}) is now active until ${end.toLocaleDateString("en-IN")}.`,
          type: "AMC",
        });
      } catch {}
    }

    res.status(201).json({ success: true, message: "AMC activated successfully", amc });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

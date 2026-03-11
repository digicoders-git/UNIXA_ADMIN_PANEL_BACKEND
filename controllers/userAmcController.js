// controllers/userAmcController.js
import UserAmc from "../models/UserAmc.js";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import AdminNotification from "../models/AdminNotification.js";
import ServiceRequest from "../models/ServiceRequest.js";
import AssignedTicket from "../models/AssignedTicket.js";

// Get all user AMCs (Admin)
export const getAllUserAmcs = async (req, res) => {
  try {
    const amcs = await UserAmc.find()
      .populate('userId', 'firstName lastName phone email addresses')
      .populate('amcPlanId', 'name')
      .populate('productId', 'name')
      .sort({ createdAt: -1 });

    res.json({ amcs });
  } catch (err) {
    console.error("getAllUserAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all active AMCs for logged-in user
export const getMyAmcs = async (req, res) => {
  try {
    const { status = 'Active', page = 1, limit = 10 } = req.query;

    const filter = { userId: req.user.sub };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const amcs = await UserAmc.find(filter)
      .populate('amcPlanId', 'name features color isPopular')
      .populate('productId', 'name mainImage img')
      .populate('orderId', '_id createdAt status')
      .sort({ endDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserAmc.countDocuments(filter);

    // Add computed fields
    const amcsWithExtras = amcs.map(amc => {
      const amcObj = amc.toObject({ virtuals: true });

      const now = new Date();
      const end = new Date(amc.endDate);
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

      const start = new Date(amc.startDate);
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
      const progressPercent = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

      return {
        ...amcObj,
        daysRemaining,
        progressPercent: Math.round(progressPercent),
        servicesRemaining: amc.servicesTotal - amc.servicesUsed
      };
    });

    res.json({
      amcs: amcsWithExtras,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("getMyAmcs error:", err);
    res.status(500).json({ message: "Server error" });
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

    const [activeCount, expiredCount, totalServices, upcomingExpiry] = await Promise.all([
      UserAmc.countDocuments({ userId, status: 'Active' }),
      UserAmc.countDocuments({ userId, status: 'Expired' }),
      UserAmc.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: '$servicesUsed' } } }
      ]),
      UserAmc.find({
        userId,
        status: 'Active',
        endDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // Next 30 days
      })
        .select('productName endDate')
        .sort({ endDate: 1 })
        .limit(5)
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
    console.error("getAmcSummary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Request service visit (add to service history)
export const requestService = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { notes } = req.body;

    const amc = await UserAmc.findOne({
      _id: amcId,
      userId: req.user.sub,
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
    const description = `AMC Service Request\nProduct: ${amc.productName}\nAMC ID: ${amc.amcId}\nNotes: ${notes || 'Service requested by customer'}`;

    await ServiceRequest.create({
      ticketId,
      userId: user._id,
      amcId: amc._id,
      customerName: `${user.firstName} ${user.lastName}`,
      customerPhone: user.phone,
      customerEmail: user.email,
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
    const amcs = await UserAmc.find({ status: 'Active' })
      .populate('userId', 'firstName lastName phone email addresses')
      .populate('amcPlanId', 'name');

    // Get all open tickets related to AMCs to avoid duplicate "Due" records
    const openAmcTickets = await AssignedTicket.find({
      amcId: { $exists: true },
      status: { $in: ['Pending', 'In Progress'] }
    }).select('amcId');

    const openAmcIds = openAmcTickets.map(t => t.amcId.toString());

    const now = new Date();
    const intervalMonths = 4;

    const dueAmcs = amcs.filter(amc => {
      // If already has an open ticket, not "Due" for a NEW one
      if (openAmcIds.includes(amc._id.toString())) return false;

      // If all services already used, not due
      if (amc.servicesUsed >= amc.servicesTotal) return false;

      const startDate = new Date(amc.startDate);
      const nextServiceNumber = amc.servicesUsed + 1;

      // Calculate due date for next service
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      // Within 15 days of due date or past due date
      const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
      return dueDate <= new Date(now.getTime() + fifteenDaysInMs);
    }).map(amc => {
      const startDate = new Date(amc.startDate);
      const nextServiceNumber = amc.servicesUsed + 1;
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      return {
        ...amc.toObject(),
        nextServiceDueDate: dueDate,
        nextServiceNumber
      };
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

    // Mark old AMC as expired if not already
    if (oldAmc.status !== 'Expired') {
      oldAmc.status = 'Expired';
      oldAmc.notes = `${oldAmc.notes || ''}\n[EXPIRED - Renewed on ${new Date().toLocaleDateString()}]`.trim();
      await oldAmc.save();
    }

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

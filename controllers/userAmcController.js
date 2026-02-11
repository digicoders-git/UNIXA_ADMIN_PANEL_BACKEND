// controllers/userAmcController.js
import UserAmc from "../models/UserAmc.js";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import AdminNotification from "../models/AdminNotification.js";

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
      .sort({ endDate: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await UserAmc.countDocuments(filter);
    
    // Add computed fields
    const amcsWithExtras = amcs.map(amc => {
      const amcObj = amc.toObject({ virtuals: true });
      
      // Calculate days remaining
      const now = new Date();
      const end = new Date(amc.endDate);
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      
      // Calculate progress percentage
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
    });
    
    if (!amc) {
      return res.status(404).json({ message: "Active AMC not found" });
    }
    
    if (amc.servicesUsed >= amc.servicesTotal) {
      return res.status(400).json({ 
        message: "All service visits have been used. Please renew your AMC." 
      });
    }
    
    // Add service request to history
    const complaintId = `SR-${Date.now().toString().slice(-6)}`;
    
    amc.serviceHistory.push({
      date: new Date(),
      type: 'Regular Service',
      notes: notes || 'Service requested by customer',
      technicianName: 'Pending Assignment',
      complaintId: complaintId
    });
    
    amc.servicesUsed += 1;
    await amc.save();

    // Create a complaint in the Customer record (for Admin Service Requests page)
    try {
      const user = await User.findById(req.user.sub);
      if (user) {
        const customer = await Customer.findOne({ $or: [{ mobile: user.phone }, { email: user.email }] });
        if (customer) {
          customer.complaints.push({
            complaintId: complaintId,
            type: "Service Request", // Matches enum in Customer.js
            description: `AMC Service Visit Request for ${amc.productName}. Notes: ${notes || 'None'}`,
            date: new Date(),
            priority: "Medium",
            status: "Open"
          });
          await customer.save();

          // Create Admin Notification
          await AdminNotification.create({
            title: "New AMC Service Request",
            message: `Customer ${customer.name} has requested a maintenance visit for ${amc.productName}`,
            type: "ServiceRequest",
            refId: complaintId
          });
        }
      }
    } catch (adminErr) {
      console.error("Failed to sync service request to admin panel:", adminErr);
    }
    
    res.json({ 
      message: "Service request submitted successfully",
      amc,
      servicesRemaining: amc.servicesTotal - amc.servicesUsed
    });
  } catch (err) {
    console.error("requestService error:", err);
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

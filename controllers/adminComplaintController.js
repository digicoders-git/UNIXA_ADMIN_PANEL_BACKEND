import Complaint from "../models/Complaint.js";
import UserNotification from "../models/UserNotification.js";
import User from "../models/User.js";
import UserAmc from "../models/UserAmc.js";
import AssignedTicket from "../models/AssignedTicket.js";
import mongoose from "mongoose";

export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 }).lean();

    // Merge assignedTechnician from AssignedTicket if not set on Complaint
    const AssignedTicket = (await import('../models/AssignedTicket.js')).default;
    const assignedTickets = await AssignedTicket.find({
      ticketType: 'complaint',
      complaintId: { $exists: true, $ne: null }
    }).select('complaintId assignedTo status').lean();

    const ticketMap = {};
    assignedTickets.forEach(t => {
      if (t.complaintId) ticketMap[t.complaintId.toString()] = t;
    });

    const merged = complaints.map(c => {
      const ticket = ticketMap[c._id.toString()];
      return {
        ...c,
        assignedTechnician: c.assignedTechnician || ticket?.assignedTo || null,
        isAssigned: !!ticket && ticket.status !== 'Cancelled'
      };
    });

    res.json(merged);
  } catch (err) {
    console.error('getAllComplaints error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, resolutionNotes, assignedTechnician, priority } = req.body;

    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    const oldStatus = complaint.status;
    if (status) complaint.status = status;
    if (resolutionNotes !== undefined) complaint.resolutionNotes = resolutionNotes;
    if (assignedTechnician !== undefined) complaint.assignedTechnician = assignedTechnician;
    if (priority) complaint.priority = priority;

    await complaint.save();

    // Notify user
    try {
      if (complaint.userId) {
        let title = "Update on your complaint";
        let message = `Your complaint ${complaintId} status is now ${status || "updated"}.`;
        if (assignedTechnician) {
          title = "Technician Assigned";
          message = `Technician ${assignedTechnician} has been assigned to your complaint ${complaintId}.`;
        } else if (status === "Resolved") {
          title = "Complaint Resolved";
          message = `Your complaint ${complaintId} has been resolved.`;
        }
        await UserNotification.create({ userId: complaint.userId, title, message, type: "Service", refId: complaintId });
      }
    } catch (e) {
      console.error("Notification error:", e);
    }

    res.json({ message: "Complaint updated successfully", complaint });
  } catch (err) {
    console.error("updateComplaint error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Search users by name or phone for offline complaint
export const searchUsersForComplaint = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const regex = new RegExp(q.trim(), 'i');
    const users = await User.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex }
      ]
    }).select('_id firstName lastName phone email address city state pincode addresses').limit(10).lean();

    // For each user, fetch their active AMCs
    const results = await Promise.all(users.map(async (u) => {
      const amcs = await UserAmc.find({ userId: u._id, status: 'Active' })
        .select('_id amcId productName amcPlanName status endDate').lean();
      return { ...u, amcs };
    }));

    res.json(results);
  } catch (err) {
    console.error('searchUsersForComplaint error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create offline complaint (admin adds on behalf of customer)
export const createOfflineComplaint = async (req, res) => {
  try {
    const {
      userId, customerName, customerPhone, customerEmail, customerAddress,
      type, description, priority, relatedItemType, relatedItemId, relatedItemName,
      expectedResolutionDate,
      // ticket assignment
      assignTo, assignedBy, dueDate, ticketNotes
    } = req.body;

    if (!customerName || !customerPhone || !type || !description) {
      return res.status(400).json({ message: 'customerName, customerPhone, type, description are required' });
    }

    // Generate complaint ID
    const count = await Complaint.countDocuments();
    const complaintId = `CMP-${String(count + 1).padStart(5, '0')}`;

    const complaint = await Complaint.create({
      complaintId,
      userId: userId || new mongoose.Types.ObjectId(),
      customerName,
      customerPhone,
      customerEmail: customerEmail || '',
      customerAddress: customerAddress || '',
      type,
      description,
      priority: priority || 'Medium',
      status: assignTo ? 'In Progress' : 'Open',
      relatedItemType: relatedItemType || 'General',
      relatedItemId: relatedItemId || '',
      relatedItemName: relatedItemName || '',
      resolutionNotes: expectedResolutionDate ? `Expected resolution: ${expectedResolutionDate}` : ''
    });

    // If employee selected, create ticket immediately
    if (assignTo) {
      await AssignedTicket.create({
        ticketType: 'complaint',
        complaintId: complaint._id,
        title: `${type} - ${customerName}`,
        description,
        notes: ticketNotes || description,
        assignedTo: assignTo,
        assignedBy: assignedBy || 'Admin',
        priority: priority || 'Medium',
        dueDate: dueDate || null,
        status: 'Pending',
        userId: userId || null,
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        address: customerAddress || 'N/A'
      });
    }

    res.status(201).json({ message: 'Offline complaint created successfully', complaint });
  } catch (err) {
    console.error('createOfflineComplaint error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const deleteComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const complaint = await Complaint.findOneAndDelete({ complaintId });
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  } catch (err) {
    console.error("deleteComplaint error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAvailableComplaints = async (req, res) => {
  try {
    // Find complaint IDs already assigned (active tickets)
    const AssignedTicket = (await import('../models/AssignedTicket.js')).default;
    const assignedTickets = await AssignedTicket.find({
      ticketType: 'complaint',
      complaintId: { $exists: true, $ne: null },
      status: { $ne: 'Cancelled' }
    }).select('complaintId').lean();

    const assignedComplaintIds = assignedTickets
      .map(t => t.complaintId?.toString())
      .filter(Boolean);

    const complaints = await Complaint.find({ status: 'Open' })
      .populate('userId', 'addresses address city state pincode')
      .sort({ createdAt: -1 })
      .lean();

    // Filter out already assigned ones and attach address
    const available = complaints
      .filter(c => !assignedComplaintIds.includes(c._id.toString()))
      .map(c => {
        let address = c.customerAddress || 'N/A';
        // Fallback: try to get from populated user if customerAddress not saved
        if (address === 'N/A') {
          const user = c.userId;
          if (user) {
            if (user.addresses && user.addresses.length > 0) {
              const primary = user.addresses.find(a => a.isDefault || a.isPrimary) || user.addresses[0];
              address = [primary.addressLine1, primary.city, primary.state, primary.pincode].filter(Boolean).join(', ');
            } else if (user.address) {
              address = [user.address, user.city, user.state, user.pincode].filter(Boolean).join(', ');
            }
          }
        }
        return { ...c, address };
      });

    res.json(available);
  } catch (err) {
    console.error('getAvailableComplaints error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

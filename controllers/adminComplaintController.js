import Complaint from "../models/Complaint.js";
import UserNotification from "../models/UserNotification.js";

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

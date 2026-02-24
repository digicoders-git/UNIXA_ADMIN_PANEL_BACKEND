import User from "../models/User.js";
import AdminNotification from "../models/AdminNotification.js";
import ServiceRequest from "../models/ServiceRequest.js";

export const createServiceRequest = async (req, res) => {
  try {
    const { type, description, date, priority } = req.body;

    if (!type || !description) {
      return res.status(400).json({ message: "Type and description are required" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const count = await ServiceRequest.countDocuments();
    const ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;

    const newRequest = await ServiceRequest.create({
      ticketId,
      userId: user._id,
      customerName: `${user.firstName} ${user.lastName}`,
      customerPhone: user.phone,
      customerEmail: user.email,
      type,
      description,
      date: date || new Date(),
      priority: priority || "Medium",
      status: "Open"
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

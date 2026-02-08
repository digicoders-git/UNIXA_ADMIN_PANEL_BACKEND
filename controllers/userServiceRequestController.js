
import Customer from "../models/Customer.js";
import User from "../models/User.js";

// Helper to find linked customer
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;
  return await Customer.findOne({ mobile: user.phone });
};

// Create a new service request
export const createServiceRequest = async (req, res) => {
  try {
    const { type, description, date, priority } = req.body;

    if (!type || !description) {
      return res.status(400).json({ message: "Type and description are required" });
    }

    const customer = await findLinkedCustomer(req.user.sub);
    if (!customer) {
      return res.status(404).json({ message: "Customer profile not found. Please contact support." });
    }

    const newComplaint = {
      complaintId: `SR-${Date.now().toString().slice(-6)}`,
      type,
      description,
      date: date || new Date(),
      priority: priority || "Medium",
      status: "Open",
      resolutionNotes: ""
    };

    customer.complaints.push(newComplaint);
    await customer.save();

    res.status(201).json({ 
      message: "Service request submitted successfully", 
      request: newComplaint 
    });
  } catch (err) {
    console.error("createServiceRequest error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user's service requests
export const getUserServiceRequests = async (req, res) => {
  try {
    const customer = await findLinkedCustomer(req.user.sub);
    
    if (!customer) {
      return res.json({ requests: [] });
    }

    // Sort by date descending
    const requests = customer.complaints.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ requests });
  } catch (err) {
    console.error("getUserServiceRequests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

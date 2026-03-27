import User from "../models/User.js";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import UserAmc from "../models/UserAmc.js";
import AdminNotification from "../models/AdminNotification.js";

export const createComplaint = async (req, res) => {
  try {
    const { type, description, priority, relatedItemType, relatedItemId, relatedItemName } = req.body;

    if (!type || !description)
      return res.status(400).json({ message: "Type and description are required" });

    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const count = await Complaint.countDocuments();
    const complaintId = `CMP-${String(count + 1).padStart(5, "0")}`;

    let customerAddress = 'N/A';
    if (user.addresses && user.addresses.length > 0) {
      const primary = user.addresses.find(a => a.isDefault || a.isPrimary) || user.addresses[0];
      customerAddress = [primary.addressLine1, primary.city, primary.state, primary.pincode].filter(Boolean).join(', ');
    } else if (user.address) {
      customerAddress = [user.address, user.city, user.state, user.pincode].filter(Boolean).join(', ');
    }

    const complaint = await Complaint.create({
      complaintId,
      userId: user._id,
      customerName: `${user.firstName} ${user.lastName}`,
      customerPhone: user.phone,
      customerEmail: user.email,
      customerAddress,
      type,
      description,
      priority: priority || "Medium",
      relatedItemType: relatedItemType || "General",
      relatedItemId: relatedItemId || null,
      relatedItemName: relatedItemName || null,
    });

    await AdminNotification.create({
      title: "New Complaint",
      message: `${user.firstName} ${user.lastName} raised a ${type} complaint - ${complaintId}`,
      type: "Alert",
      refId: complaintId,
    });

    res.status(201).json({ message: "Complaint submitted successfully", complaint });
  } catch (err) {
    console.error("createComplaint error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.sub }).sort({ createdAt: -1 });
    res.json({ complaints });
  } catch (err) {
    console.error("getUserComplaints error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getComplaintItems = async (req, res) => {
  try {
    const userId = req.user.sub;
    const [orders, amcs] = await Promise.all([
      Order.find({ userId, status: { $nin: ["cancelled"] } })
        .select("_id items.productName createdAt status")
        .sort({ createdAt: -1 }).limit(20).lean(),
      UserAmc.find({ userId, status: "Active" })
        .select("_id productName amcPlanName startDate").lean(),
    ]);

    const items = [
      ...orders.map(o => ({
        id: o._id,
        type: "Order",
        name: o.items.map(i => i.productName).join(", "),
        label: `Order #${String(o._id).slice(-6).toUpperCase()} - ${o.items.map(i => i.productName).join(", ")}`,
      })),
      ...amcs.map(a => ({
        id: a._id,
        type: "AMC",
        name: `${a.productName} (${a.amcPlanName})`,
        label: `AMC - ${a.productName} (${a.amcPlanName})`,
      })),
    ];

    res.json({ items });
  } catch (err) {
    console.error("getComplaintItems error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

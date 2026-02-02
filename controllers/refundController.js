import RefundRequest from "../models/RefundRequest.js";
import Order from "../models/Order.js";

// Get all refund requests
export const getRefunds = async (req, res) => {
  try {
    const { status, type } = req.query;
    let query = {};
    if (status && status !== "All") query.status = status;
    if (type && type !== "All") query.type = type;

    const refunds = await RefundRequest.find(query)
      .populate("orderId")
      .populate("userId", "name email mobile")
      .sort({ createdAt: -1 });
    res.json(refunds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a refund/cancellation request (Usually from User App, but Admin can also initiate)
export const createRefundRequest = async (req, res) => {
  try {
    const { orderId, userId, type, reason, amount } = req.body;
    
    // Check if request already exists
    const existing = await RefundRequest.findOne({ orderId, status: { $in: ["Pending", "Approved"] } });
    if(existing) return res.status(400).json({ message: "Request already pending for this order" });

    const request = new RefundRequest({ orderId, userId, type, reason, amount });
    await request.save();
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update status (Approve/Reject)
export const updateRefundStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminComments } = req.body;

        const request = await RefundRequest.findById(id);
        if(!request) return res.status(404).json({ message: "Request not found" });

        request.status = status;
        if(adminComments) request.adminComments = adminComments;

        if (status === "Approved" || status === "Refunded") {
             // If cancelled/refunded, update the main order status too if needed
             if (request.type === "Cancellation") {
                 await Order.findByIdAndUpdate(request.orderId, { status: "cancelled" });
             } 
             // If Return, maybe status = "returned" ? Order model typically has pending/confirmed/etc. 
             // We can let order status remain or add a new status.
        }

        await request.save();
        res.json(request);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

// Delete request
export const deleteRefundRequest = async (req, res) => {
    try {
        await RefundRequest.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

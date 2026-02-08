import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import moment from "moment-timezone";

// Helper to find linked customer (Robust logic)
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  // Try to find customer by various means
  const searchValues = [];
  if (user.phone) {
      searchValues.push({ mobile: user.phone });
      // Also try last 10 digits if possible
      const last10 = user.phone.replace(/\D/g, '').slice(-10);
      if (last10.length === 10) {
          searchValues.push({ mobile: { $regex: last10, $options: 'i' } });
      }
  }
  if (user.email) {
      searchValues.push({ email: { $regex: `^${user.email}$`, $options: 'i' } });
  }

  let customer = null;
  if(searchValues.length > 0) {
      customer = await Customer.findOne({ $or: searchValues });
  }

  return { user, customer };
};

export const getUserDashboardStats = async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // 1. Fetch User & Linked Customer
    const linkedData = await findLinkedCustomer(userId);
    if (!linkedData || !linkedData.user) return res.status(404).json({ message: "User not found" });
    
    const { user, customer } = linkedData;

    // 2. Fetch Orders Stats
    // Ensure userId is ObjectId for Order queries
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const totalOrders = await Order.countDocuments({ userId: userObjectId });
    
    const activeOrdersCount = await Order.countDocuments({
      userId: userObjectId,
      status: { $nin: ["delivered", "cancelled", "returned"] }
    });

    // Aggregate total spent (excluding cancelled/returned)
    const spentAgg = await Order.aggregate([
      { 
        $match: { 
          userId: userObjectId, 
          status: { $nin: ["cancelled", "returned", "failed"] } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    const totalSpent = spentAgg[0]?.total || 0;

    // 3. Recent Orders
    const recentOrders = await Order.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderId items total status createdAt");

    // 4. AMC Status
    let amcStatus = {
        active: false,
        planName: "No Active Plan",
        expiry: null,
        status: "Inactive"
    };

    if (customer && customer.amcDetails && customer.amcDetails.planName) {
        const endDate = moment(customer.amcDetails.endDate);
        const now = moment();
        
        // Check if actually active (date check + status check)
        const isDateActive = endDate.isAfter(now);
        const isStatusActive = customer.amcDetails.status === 'Active';

        if (isDateActive && isStatusActive) {
            amcStatus = {
                active: true,
                planName: customer.amcDetails.planName,
                expiry: endDate.format("MMM DD, YYYY"),
                status: "Active"
            };
        } else if (!isDateActive) {
             amcStatus.status = "Expired";
             amcStatus.planName = customer.amcDetails.planName;
             amcStatus.expiry = endDate.format("MMM DD, YYYY");
        } else {
             amcStatus.status = customer.amcDetails.status; // e.g., Pending
             amcStatus.planName = customer.amcDetails.planName;
        }
    }

    // 5. Recent Activity (Combine orders and service requests)
    let activities = [];
    
    // Add orders to activity
    recentOrders.forEach(order => {
        activities.push({
            type: 'order',
            title: `Order #${(order.orderId || order._id.toString().slice(-6)).toUpperCase()}`,
            date: order.createdAt,
            status: order.status,
            amount: order.total
        });
    });

    // Add complaints/service to activity
    if (customer && customer.complaints && customer.complaints.length > 0) {
        // Sort complaints desc
        const sortedComplaints = [...customer.complaints].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        
        sortedComplaints.forEach(comp => {
            activities.push({
                type: 'service',
                title: `Service: ${comp.type}`,
                date: comp.date,
                status: comp.status,
                desc: comp.description
            });
        });
    }

    // Sort combined activity by date desc
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    activities = activities.slice(0, 5); // Keep top 5

    // 6. Rental Status
    let rentalStatus = {
        active: false,
        planName: "No Active Rental",
        status: "Inactive",
        expiry: null
    };

    if (customer && customer.rentalDetails && customer.rentalDetails.planName) {
        const endDate = moment(customer.rentalDetails.endDate);
        const now = moment();
        const isDateActive = endDate.isAfter(now);
        const isStatusActive = customer.rentalDetails.status === 'Active';

        if (isDateActive && isStatusActive) {
            rentalStatus = {
                active: true,
                planName: customer.rentalDetails.planName,
                status: "Active",
                expiry: endDate.format("MMM DD, YYYY")
            };
        } else if (!isDateActive) {
            rentalStatus.status = "Expired";
            rentalStatus.planName = customer.rentalDetails.planName;
            rentalStatus.expiry = endDate.format("MMM DD, YYYY");
        } else {
            rentalStatus.status = customer.rentalDetails.status;
            rentalStatus.planName = customer.rentalDetails.planName;
        }
    }

    res.json({
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone
      },
      stats: {
        totalOrders,
        activeOrders: activeOrdersCount,
        totalSpent,
        points: 0 // Placeholder
      },
      amc: amcStatus,
      rental: rentalStatus,
      recentActivity: activities
    });

  } catch (error) {
    console.error("User Dashboard Error:", error);
    res.status(500).json({ message: "Server error fetching dashboard" });
  }
};

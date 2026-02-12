import mongoose from "mongoose";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import UserAmc from "../models/UserAmc.js";
import moment from "moment-timezone";

// Helper to find linked customer (Robust logic)
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { user: null, customer: null };

  const query = [];
  
  // 1. Match by Phone (Fuzzy match for last 10 digits)
  if (user.phone) {
    const normalizedPhone = user.phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length === 10) {
      const fuzzyPattern = normalizedPhone.split("").join("[^0-9]*") + "$";
      query.push({ mobile: { $regex: fuzzyPattern } });
    } else {
      query.push({ mobile: new RegExp(user.phone.replace(/\D/g, "") + "$") });
    }
  }

  // 2. Match by Email
  if (user.email) {
    query.push({ email: { $regex: `^${user.email}$`, $options: 'i' } });
  }

  if (query.length === 0) return { user, customer: null };

  const customer = await Customer.findOne({ $or: query });
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

    // 4. AMC Status (Check UserAmc model FIRST, then Customer fallback)
    let amcStatus = {
        active: false,
        planName: "No Active Plan",
        expiry: null,
        status: "Inactive"
    };

    // Check for web-purchased UserAmc first
    const activeUserAmc = await UserAmc.findOne({ 
        userId: userObjectId, 
        status: 'Active' 
    }).sort({ endDate: -1 });

    if (activeUserAmc) {
        amcStatus = {
            active: true,
            planName: activeUserAmc.amcPlanName,
            expiry: moment(activeUserAmc.endDate).format("MMM DD, YYYY"),
            status: "Active"
        };
    } else if (customer && customer.amcDetails && (customer.amcDetails.planName || customer.amcDetails.amcId)) {
        // Fallback to Admin-managed Customer record
        const endDate = moment(customer.amcDetails.endDate);
        const now = moment();
        const isStatusActive = customer.amcDetails.status === 'Active';

        if (isStatusActive) {
            amcStatus = {
                active: true,
                planName: customer.amcDetails.planName || "Active AMC",
                expiry: customer.amcDetails.endDate ? endDate.format("MMM DD, YYYY") : "Long-term",
                status: "Active"
            };
        } else {
             amcStatus.status = customer.amcDetails.status || "Inactive";
             amcStatus.planName = customer.amcDetails.planName || "No Active Plan";
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
            amount: order.total,
            refId: order.orderId || order._id
        });
    });

    // Add complaints/service to activity
    if (customer && customer.complaints && customer.complaints.length > 0) {
        customer.complaints.forEach(comp => {
            activities.push({
                type: 'service',
                title: `Service: ${comp.type}`,
                date: comp.date,
                status: comp.status,
                desc: comp.description,
                refId: comp.complaintId
            });
        });
    }

    // Add service history from UserAmc
    const userAmcs = await UserAmc.find({ userId: userObjectId });
    userAmcs.forEach(uamc => {
        if (uamc.serviceHistory && uamc.serviceHistory.length > 0) {
            uamc.serviceHistory.forEach(svc => {
                activities.push({
                    type: 'service',
                    title: `Visit: ${svc.type}`,
                    date: svc.date,
                    status: 'resolved'
                });
            });
        }
    });

    // Sort combined activity by date desc
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    activities = activities.slice(0, 5); // Show only top 5 on dashboard as requested

    // 6. Rental Status (Priority: UserAmc with RentalPlan tag, fallback: admin Customer record)
    let rentalStatus = {
        active: false,
        planName: "No Active Rental",
        status: "Inactive",
        expiry: null
    };

    // Check if user has an active Rental but as a web purchase
    const webRental = await UserAmc.findOne({ 
        userId: userObjectId, 
        status: 'Active',
        productType: 'RentalPlan'
    }).sort({ endDate: -1 });

    if (webRental) {
        rentalStatus = {
            active: true,
            planName: webRental.productName,
            status: "Active",
            expiry: moment(webRental.endDate).format("MMM DD, YYYY")
        };
    } else if (customer) {
        if (customer.rentalDetails && customer.rentalDetails.status !== 'Inactive') {
            rentalStatus = {
                active: true,
                planName: customer.rentalDetails.planName || customer.rentalDetails.machineModel || "Active Rental",
                status: customer.rentalDetails.status,
                expiry: customer.rentalDetails.nextDueDate ? moment(customer.rentalDetails.nextDueDate).format("MMM DD, YYYY") : "Next Due: N/A"
            };
        } else if (customer.status === 'Active' && customer.purifiers && customer.purifiers.length > 0) {
            // Fallback for cases where admin only adds to purifier list
            const firstUnit = customer.purifiers[0];
            rentalStatus = {
                active: true,
                planName: "Active Rental Machine",
                status: "Active",
                expiry: firstUnit.installationDate ? moment(firstUnit.installationDate).add(1, 'month').format("MMM DD, YYYY") : "Renewing Monthly"
            };
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

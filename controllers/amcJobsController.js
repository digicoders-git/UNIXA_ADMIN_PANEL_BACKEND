import UserAmc from "../models/UserAmc.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";

// Helper to get customer data from fallback sources
const getCustomerFallback = async (phone, userId = null) => {
  if (userId) {
    const user = await User.findById(userId).select('firstName lastName email phone addresses city state').lean();
    if (user) {
      return {
        _id: user._id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        email: user.email,
        phone: user.phone,
        address: user.addresses?.[0] || {}
      };
    }
  }

  if (phone) {
    // Try Customer model
    const customer = await Customer.findOne({ mobile: phone }).lean();
    if (customer) {
      return {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.mobile,
        address: { 
          addressLine1: `${customer.address?.house || ''} ${customer.address?.area || ''}`.trim(),
          city: customer.address?.city,
          pincode: customer.address?.pincode
        }
      };
    }

    // Try Order model
    const lastOrder = await Order.findOne({ "shippingAddress.phone": phone }).sort({ createdAt: -1 }).lean();
    if (lastOrder) {
      return {
        _id: phone,
        name: lastOrder.shippingAddress.name,
        email: lastOrder.shippingAddress.email,
        phone: lastOrder.shippingAddress.phone,
        address: {
          addressLine1: lastOrder.shippingAddress.addressLine1,
          city: lastOrder.shippingAddress.city,
          pincode: lastOrder.shippingAddress.pincode
        }
      };
    }
  }

  return null;
};

// Get upcoming service jobs (due within 7 days or overdue)
export const getUpcomingServiceJobs = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const intervalMonths = 4;

    // Fetch active AMCs that might be due or overdue
    const jobs = await UserAmc.find({
      status: 'Active',
      $expr: { $lt: ['$servicesUsed', '$servicesTotal'] }
    })
      .populate('userId', 'firstName lastName email phone addresses city state')
      .populate('amcPlanId')
      .populate('productId')
      .lean();

    const formattedJobs = [];

    for (const job of jobs) {
      if (!job.startDate) continue;

      const nextServiceNumber = (job.servicesUsed || 0) + 1;
      const dueDate = new Date(job.startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      // If it's due (overdue or within 7 days)
      if (dueDate && new Date(dueDate) <= sevenDaysLater) {
        let customer = null;
        if (job.userId) {
          customer = {
            _id: job.userId._id,
            name: `${job.userId.firstName || ''} ${job.userId.lastName || ''}`.trim() || 'User',
            email: job.userId.email,
            phone: job.userId.phone,
            address: job.userId.addresses?.[0] || {}
          };
        } else {
          customer = await getCustomerFallback(job.customerPhone);
        }

        const dDate = new Date(dueDate);
        const daysUntilService = Math.ceil((dDate - now) / (1000 * 60 * 60 * 24));

        formattedJobs.push({
          _id: job._id,
          amcId: job.amcId,
          productName: job.productName,
          amcPlanName: job.amcPlanName,
          nextServiceDueDate: dDate,
          daysUntilService: daysUntilService,
          serviceType: job.serviceSchedule?.serviceType || 'Regular Service',
          serviceDescription: job.serviceSchedule?.description,
          servicesUsed: job.servicesUsed,
          servicesTotal: job.servicesTotal,
          status: job.status,
          customer
        });
      }
    }

    // Sort by due date (overdue first)
    formattedJobs.sort((a, b) => new Date(a.nextServiceDueDate) - new Date(b.nextServiceDueDate));

    res.json({
      count: formattedJobs.length,
      jobs: formattedJobs
    });
  } catch (err) {
    console.error("getUpcomingServiceJobs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all AMC statistics
export const getAmcStatistics = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const intervalMonths = 4;

    // Fetch all active AMCs to perform manual calculation for robust stats
    const activeAmcs = await UserAmc.find({ status: 'Active' })
      .select('startDate nextServiceDueDate servicesUsed servicesTotal').lean();

    let upcomingCount = 0;
    let overdueCount = 0;

    activeAmcs.forEach(amc => {
      if (!amc.startDate) return;
      if (amc.servicesUsed >= amc.servicesTotal) return;

      const nextServiceNumber = (amc.servicesUsed || 0) + 1;
      const dueDate = new Date(amc.startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      const dDate = new Date(dueDate);
      if (dDate < now) {
        overdueCount++;
      } else if (dDate <= sevenDaysLater) {
        upcomingCount++;
      }
    });

    const stats = {
      totalActive: activeAmcs.length,
      totalExpired: await UserAmc.countDocuments({ status: 'Expired' }),
      upcomingServices: upcomingCount,
      overdueServices: overdueCount
    };
    
    res.json(stats);
  } catch (err) {
    console.error("getAmcStatistics error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all AMCs with filters
export const getAllAmcs = async (req, res) => {
  try {
    const { status, filter } = req.query;
    let query = {};
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const intervalMonths = 4;
    
    if (status) query.status = status;
    
    // If filtering by due status, we need to fetch all active to check fallbacks
    const needsManualCheck = filter === 'upcoming' || filter === 'overdue';
    
    if (needsManualCheck) {
      query.status = 'Active';
      query.$expr = { $lt: ['$servicesUsed', '$servicesTotal'] };
    }
    
    const amcs = await UserAmc.find(query)
      .populate('userId', 'firstName lastName email phone addresses city state')
      .populate('amcPlanId', 'name durationMonths serviceSchedule')
      .populate('productId', 'name')
      .sort({ nextServiceDueDate: 1 })
      .limit(500)
      .lean();
    
    let finalAmcs = [];

    for (const amc of amcs) {
      if (!amc.startDate) continue;

      const nextServiceNumber = (amc.servicesUsed || 0) + 1;
      const dueDate = new Date(amc.startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      const dDate = new Date(dueDate);
      
      // Apply filters manually if needed
      if (filter === 'upcoming') {
        if (!dDate || dDate > sevenDaysLater) continue;
      } else if (filter === 'overdue') {
        if (!dDate || dDate >= now) continue;
      }

      let customer = null;
      if (amc.userId) {
        customer = {
          _id: amc.userId._id,
          name: `${amc.userId.firstName || ''} ${amc.userId.lastName || ''}`.trim() || 'User',
          email: amc.userId.email,
          phone: amc.userId.phone,
          city: amc.userId.city,
          state: amc.userId.state,
          address: amc.userId.addresses?.[0]
        };
      } else {
        customer = await getCustomerFallback(amc.customerPhone);
      }

      finalAmcs.push({
        _id: amc._id,
        amcId: amc.amcId,
        productName: amc.productName,
        productImage: amc.productImage,
        amcPlanName: amc.amcPlanName,
        durationMonths: amc.durationMonths,
        startDate: amc.startDate,
        endDate: amc.endDate,
        nextServiceDueDate: dDate,
        daysUntilService: dDate ? 
          Math.ceil((dDate - now) / (1000 * 60 * 60 * 24)) : null,
        serviceType: amc.serviceSchedule?.serviceType || 'Regular Service',
        servicesUsed: amc.servicesUsed,
        servicesTotal: amc.servicesTotal,
        status: amc.status,
        customer
      });
    }

    res.json({
      count: finalAmcs.length,
      amcs: finalAmcs
    });
  } catch (err) {
    console.error("getAllAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update next service due date for an AMC
export const updateNextServiceDueDate = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { nextServiceDueDate } = req.body;
    
    const amc = await UserAmc.findByIdAndUpdate(
      amcId,
      { nextServiceDueDate: new Date(nextServiceDueDate) },
      { new: true }
    );
    
    if (!amc) {
      return res.status(404).json({ message: "AMC not found" });
    }
    
    res.json({ message: "Next service due date updated", amc });
  } catch (err) {
    console.error("updateNextServiceDueDate error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

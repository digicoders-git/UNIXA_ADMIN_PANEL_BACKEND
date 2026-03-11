import moment from "moment-timezone";
import ServiceRequest from "../models/ServiceRequest.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";
import Lead from "../models/Lead.js";
import UserAmc from "../models/UserAmc.js";

// @desc    Get Manager Dashboard Stats
// @route   GET /api/manager-dashboard/stats
// @access  Private (Manager)
export const getManagerDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();

    // Parallelize all data fetching
    const [
      totalTickets,
      pendingTicketsCount,
      totalLeads,
      totalEmployees,
      ticketsLast7Days,
      leadsLast7Days,
      topTickets,
      topLeads,
      allAmcsForStatsRaw
    ] = await Promise.all([
      // Basic counts
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: { $ne: "Resolved" } }),
      Lead.countDocuments(),
      Employee.countDocuments({ role: { $ne: "Manager" } }),

      // Chart data - Tickets in last 7 days
      ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
            count: { $sum: 1 }
          }
        }
      ]),

      // Chart data - Leads in last 7 days
      Lead.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
            count: { $sum: 1 }
          }
        }
      ]),

      // Recent activity data
      ServiceRequest.find().sort({ createdAt: -1 }).limit(3).select('customerName type createdAt'),
      Lead.find().sort({ createdAt: -1 }).limit(3).select('name createdAt'),

      // Fetch all AMCs for dynamic calculation
      UserAmc.find().select('status startDate endDate servicesUsed servicesTotal')
    ]);

    // Prepare stats object
    const allAmcsForStats = allAmcsForStatsRaw || [];
    let activeAmcCount = 0;
    let expiredAmcCount = 0;
    const totalAmcCount = allAmcsForStats.length;
    const nowTime = new Date().getTime();

    // Dynamically calculate active and expired AMCs
    allAmcsForStats.forEach(amc => {
      const isDateExpired = new Date(amc.endDate).getTime() < nowTime;
      const isServicesExhausted = (amc.servicesUsed || 0) >= (amc.servicesTotal || 4);
      if (amc.status === 'Active' && !isDateExpired && !isServicesExhausted) {
        activeAmcCount++;
      } else if (amc.status === 'Expired' || isDateExpired || isServicesExhausted) {
        expiredAmcCount++;
      }
    });

    const dueAmcCount = allAmcsForStats.filter(amc => {
      const isDateExpired = new Date(amc.endDate).getTime() < nowTime;
      const isServicesExhausted = (amc.servicesUsed || 0) >= (amc.servicesTotal || 4);
      if (isDateExpired || isServicesExhausted) return false;

      const startDate = new Date(amc.startDate);
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + ((amc.servicesUsed + 1) * 4));
      return dueDate <= new Date(nowTime + (15 * 24 * 60 * 60 * 1000));
    }).length;

    // Prepare chart data structure
    const ticketsPerDay = {};
    const leadsPerDay = {};

    for (let i = 0; i < 7; i++) {
      const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD");
      ticketsPerDay[dateStr] = 0;
      leadsPerDay[dateStr] = 0;
    }

    ticketsLast7Days.forEach(item => { if (ticketsPerDay[item._id] !== undefined) ticketsPerDay[item._id] = item.count; });
    leadsLast7Days.forEach(item => { if (leadsPerDay[item._id] !== undefined) leadsPerDay[item._id] = item.count; });

    const sortedDates = Object.keys(ticketsPerDay).sort();
    const categories = sortedDates.map(date => moment(date).format("ddd"));
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);

    // Combine recent activity
    const recentActivity = [
      ...topTickets.map(t => ({
        type: 'Ticket',
        name: t.customerName,
        action: `raised a ${t.type || 'service request'}`,
        time: moment(t.createdAt).fromNow(),
        color: 'red',
        date: new Date(t.createdAt)
      })),
      ...topLeads.map(l => ({
        type: 'Lead',
        name: l.name,
        action: `submitted a lead`,
        time: moment(l.createdAt).fromNow(),
        color: 'blue',
        date: new Date(l.createdAt)
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 5);

    res.json({
      stats: {
        totalTickets,
        pendingTickets: pendingTicketsCount,
        totalLeads,
        totalEmployees,
        totalAmcs: totalAmcCount,
        activeAmcs: activeAmcCount,
        expiredAmcs: expiredAmcCount,
        dueAmcs: dueAmcCount
      },
      chart: {
        categories,
        series: [
          { name: 'Tickets', data: ticketsSeries, color: '#3182CE' },
          { name: 'Leads', data: leadsSeries, color: '#38B2AC' }
        ]
      },
      recentActivity
    });

  } catch (error) {
    console.error("Manager Dashboard Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get All User AMCs for Manager
// @route   GET /api/manager-dashboard/user-amcs
// @access  Private (Manager)
export const getManagerUserAmcs = async (req, res) => {
  try {
    const amcs = await UserAmc.find()
      .populate('userId', 'firstName lastName phone email')
      .populate('amcPlanId', 'name')
      .populate('productId', 'name')
      .sort({ createdAt: -1 });

    res.json({ amcs });
  } catch (error) {
    console.error("Manager User AMCs Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get AMCs Due for Service (every 4 months)
// @route   GET /api/manager-dashboard/due-amcs
// @access  Private (Manager)
export const getManagerDueAmcs = async (req, res) => {
  try {
    const amcs = await UserAmc.find({ status: 'Active' })
      .populate('userId', 'firstName lastName phone email')
      .populate('amcPlanId', 'name');

    const now = new Date();
    const intervalMonths = 4;

    const dueAmcs = amcs.filter(amc => {
      if (amc.servicesUsed >= amc.servicesTotal) return false;

      const startDate = new Date(amc.startDate);
      const nextServiceNumber = amc.servicesUsed + 1;

      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
      return dueDate <= new Date(now.getTime() + fifteenDaysInMs);
    }).map(amc => {
      const startDate = new Date(amc.startDate);
      const nextServiceNumber = amc.servicesUsed + 1;
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextServiceNumber * intervalMonths));

      return {
        ...amc.toObject(),
        nextServiceDueDate: dueDate,
        nextServiceNumber
      };
    });

    res.json({ amcs: dueAmcs });
  } catch (err) {
    console.error("getManagerDueAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

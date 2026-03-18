import moment from "moment-timezone";
import ServiceRequest from "../models/ServiceRequest.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";
import Lead from "../models/Lead.js";
import UserAmc from "../models/UserAmc.js";
import AssignedTicket from "../models/AssignedTicket.js";
import Order from "../models/Order.js";

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
      // Basic counts - from AssignedTicket
      AssignedTicket.countDocuments(),
      AssignedTicket.countDocuments({ status: { $ne: "Completed" } }),
      Lead.countDocuments(),
      Employee.countDocuments({ role: { $ne: "Manager" } }),

      // Chart data - Tickets in last 7 days
      AssignedTicket.aggregate([
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

      // Recent activity data - from AssignedTicket with status
      AssignedTicket.find().sort({ createdAt: -1 }).limit(3).select('title assignedTo createdAt status priority description'),
      Lead.find().sort({ createdAt: -1 }).limit(3).select('name createdAt status source email'),

      // Fetch all AMCs for dynamic calculation
      UserAmc.find().select('status startDate endDate nextServiceDueDate servicesUsed servicesTotal')
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
      if (amc.status !== 'Active') return false;
      const isDateExpired = new Date(amc.endDate).getTime() < nowTime;
      const isServicesExhausted = (amc.servicesUsed || 0) >= (amc.servicesTotal || 4);
      if (isDateExpired || isServicesExhausted) return false;

      // Calculate mandatory 4-month due date
      if (!amc.startDate) return false;
      const interval = amc.serviceSchedule?.intervalMonths || 4;
      const nextNum = (amc.servicesUsed || 0) + 1;
      const dueDate = new Date(amc.startDate);
      dueDate.setMonth(dueDate.getMonth() + (nextNum * interval));

      const limit = new Date(nowTime + (15 * 24 * 60 * 60 * 1000));
      return dueDate <= limit;
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
        name: t.title,
        action: `assigned to ${t.assignedTo}`,
        time: moment(t.createdAt).fromNow(),
        color: 'red',
        date: new Date(t.createdAt),
        status: t.status
      })),
      ...topLeads.map(l => ({
        type: 'Lead',
        name: l.name,
        action: `submitted a lead`,
        time: moment(l.createdAt).fromNow(),
        color: 'blue',
        date: new Date(l.createdAt),
        status: l.status
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
      .populate('userId', 'firstName lastName phone email address city state pincode addresses profilePicture createdAt')
      .populate('amcPlanId', 'name')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const offlinePhones = [...new Set(amcs.filter(a => !a.userId && a.customerPhone).map(a => a.customerPhone))];
    const offlineOrders = offlinePhones.length > 0
      ? await Order.find({ 'shippingAddress.phone': { $in: offlinePhones } }).select('shippingAddress').lean()
      : [];
    const orderMap = {};
    offlineOrders.forEach(o => { orderMap[o.shippingAddress.phone] = o; });

    const amcsWithUser = amcs.map(amc => {
      if (!amc.userId && amc.customerPhone) {
        const order = orderMap[amc.customerPhone];
        amc.userId = {
          firstName: order?.shippingAddress?.name || 'Offline',
          lastName: order ? '' : 'Customer',
          phone: amc.customerPhone,
          email: order?.shippingAddress?.email || '',
          address: order?.shippingAddress?.addressLine1 ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city || ''}` : '',
          createdAt: amc.createdAt
        };
      }
      return amc;
    });

    res.json({ amcs: amcsWithUser });
  } catch (error) {
    console.error("Manager User AMCs Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getManagerDueAmcs = async (req, res) => {
  try {
    const amcs = await UserAmc.find({ status: 'Active' })
      .populate('userId', 'firstName lastName phone email address city state pincode addresses')
      .populate('amcPlanId', 'name')
      .lean();

    const now = new Date();
    const limit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const filtered = amcs.filter(amc => {
      if (!amc.startDate || amc.servicesUsed >= (amc.servicesTotal || 4)) return false;
      const dueDate = amc.nextServiceDueDate
        ? new Date(amc.nextServiceDueDate)
        : (() => { const d = new Date(amc.startDate); d.setMonth(d.getMonth() + ((amc.servicesUsed || 0) + 1) * 4); return d; })();
      return dueDate <= limit;
    });

    const offlinePhones = [...new Set(filtered.filter(a => !a.userId && a.customerPhone).map(a => a.customerPhone))];
    const offlineOrders = offlinePhones.length > 0
      ? await Order.find({ 'shippingAddress.phone': { $in: offlinePhones } }).select('shippingAddress').lean()
      : [];
    const orderMap = {};
    offlineOrders.forEach(o => { orderMap[o.shippingAddress.phone] = o; });

    const processedAmcs = filtered.map(amc => {
      const dueDate = amc.nextServiceDueDate
        ? new Date(amc.nextServiceDueDate)
        : (() => { const d = new Date(amc.startDate); d.setMonth(d.getMonth() + ((amc.servicesUsed || 0) + 1) * 4); return d; })();

      if (!amc.userId && amc.customerPhone) {
        const order = orderMap[amc.customerPhone];
        amc.userId = {
          firstName: order?.shippingAddress?.name?.split(' ')[0] || 'Offline',
          lastName: order?.shippingAddress?.name?.split(' ').slice(1).join(' ') || 'Customer',
          phone: amc.customerPhone,
          email: order?.shippingAddress?.email || '',
          address: order?.shippingAddress?.addressLine1 || '',
          isOffline: true
        };
      } else if (amc.userId && !amc.userId.address) {
        const addr = amc.userId.addresses?.[0];
        amc.userId.address = addr
          ? `${addr.addressLine1 || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.pincode || ''}`.replace(/,\s*,/g, ',').trim()
          : [amc.userId.city, amc.userId.state, amc.userId.pincode].filter(Boolean).join(', ');
      }

      return { ...amc, nextServiceDueDate: dueDate, nextServiceNumber: (amc.servicesUsed || 0) + 1 };
    });

    processedAmcs.sort((a, b) => new Date(a.nextServiceDueDate) - new Date(b.nextServiceDueDate));
    res.json({ amcs: processedAmcs });
  } catch (err) {
    console.error("getManagerDueAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

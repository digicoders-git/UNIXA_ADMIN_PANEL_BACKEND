import moment from "moment-timezone";
import ServiceRequest from "../models/ServiceRequest.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";

// @desc    Get Manager Dashboard Stats
// @route   GET /api/manager-dashboard/stats
// @access  Private (Manager)
export const getManagerDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();

    // 1. Fetch Service Requests (Tickets)
    const allTickets = await ServiceRequest.find().sort({ createdAt: -1 });
    const totalTickets = allTickets.length;
    const pendingTickets = allTickets.filter(t => t.status !== "Resolved").length;
    
    // 2. Fetch Enquiries (Leads)
    const totalLeads = await Enquiry.countDocuments();

    // 3. Fetch Employees
    const totalEmployees = await Employee.countDocuments({ role: { $ne: "Manager" } });
    
    // 4. Weekly Performance Chart Data
    const ticketsPerDay = {};
    const leadsPerDay = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
        const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD");
        ticketsPerDay[dateStr] = 0;
        leadsPerDay[dateStr] = 0;
    }

    // Process Tickets for Chart
    allTickets.forEach(t => {
      const dateStr = moment(t.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (ticketsPerDay[dateStr] !== undefined) {
        ticketsPerDay[dateStr]++;
      }
    });

    // Process Leads for Chart
    const recentEnquiries = await Enquiry.find({ createdAt: { $gte: last7Days } });
    recentEnquiries.forEach(e => {
      const dateStr = moment(e.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (leadsPerDay[dateStr] !== undefined) {
        leadsPerDay[dateStr]++;
      }
    });

    const categories = Object.keys(ticketsPerDay).sort().map(date => moment(date).format("ddd"));
    const sortedDates = Object.keys(ticketsPerDay).sort();
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);

    // 5. Recent Activity
    const recentActivity = [];
    
    // Add top 3 recent tickets
    allTickets.slice(0, 3).forEach(ticket => {
        recentActivity.push({
            type: 'Ticket',
            name: ticket.customerName,
            action: `raised a ${ticket.type || 'service request'}`,
            time: moment(ticket.createdAt).fromNow(),
            color: 'red',
            date: new Date(ticket.createdAt)
        });
    });

    // Add top 3 recent leads
    const topLeads = await Enquiry.find().sort({ createdAt: -1 }).limit(3);
    topLeads.forEach(lead => {
        recentActivity.push({
            type: 'Lead',
            name: lead.name,
            action: `submitted an enquiry`,
            time: moment(lead.createdAt).fromNow(),
            color: 'blue',
            date: new Date(lead.createdAt)
        });
    });

    // Sort combined activity by date desc and take top 5
    recentActivity.sort((a, b) => b.date - a.date);
    const finalRecentActivity = recentActivity.slice(0, 5);

    res.json({
      stats: {
        totalTickets,
        pendingTickets,
        totalLeads,
        totalEmployees
      },
      chart: {
        categories,
        series: [
          { name: 'Tickets', data: ticketsSeries, color: '#3182CE' },
          { name: 'Leads', data: leadsSeries, color: '#38B2AC' }
        ]
      },
      recentActivity: finalRecentActivity
    });

  } catch (error) {
    console.error("Manager Dashboard Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

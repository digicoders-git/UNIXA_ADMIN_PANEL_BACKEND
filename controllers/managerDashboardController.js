import moment from "moment-timezone";
import Customer from "../models/Customer.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";

// @desc    Get Manager Dashboard Stats
// @route   GET /api/manager-dashboard/stats
// @access  Private (Manager)
export const getManagerDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();
    const startOfToday = now.clone().startOf("day").toDate();

    // 1. Fetch all customers to aggregate complaints
    const customers = await Customer.find({ "complaints.0": { $exists: true } }).select("complaints name mobile");

    // Flatten complaints
    let allComplaints = [];
    customers.forEach(customer => {
      if (customer.complaints && customer.complaints.length > 0) {
        customer.complaints.forEach(complaint => {
          allComplaints.push({
            ...complaint.toObject(),
            customerName: customer.name,
            customerMobile: customer.mobile
          });
        });
      }
    });

    // Sort complaints by date descending
    allComplaints.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Complaint Stats
    const totalTickets = allComplaints.length;
    const pendingTickets = allComplaints.filter(c => c.status !== "Resolved").length;
    
    // 2. Fetch Enquiries (Leads)
    const totalLeads = await Enquiry.countDocuments();
    const newLeads = await Enquiry.countDocuments({ createdAt: { $gte: now.clone().subtract(30, 'days').toDate() } });

    // 3. Fetch Employees
    const totalEmployees = await Employee.countDocuments({ role: { $ne: "Manager" } }); // Exclude managers if needed, or just count all
    
    // 4. Weekly Performance Chart Data
    const ticketsPerDay = {};
    const leadsPerDay = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
        const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD"); // Using MM-DD for chart, or YYYY-MM-DD for key
        ticketsPerDay[dateStr] = 0;
        leadsPerDay[dateStr] = 0;
    }

    // Process Tickets for Chart
    allComplaints.forEach(c => {
      const dateStr = moment(c.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
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

    const categories = Object.keys(ticketsPerDay).sort().map(date => moment(date).format("ddd")); // Mon, Tue...
    const sortedDates = Object.keys(ticketsPerDay).sort();
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);

    // 5. Recent Activity (Mix of new tickets and new leads)
    const recentActivity = [];
    
    // Add top 3 recent tickets
    allComplaints.slice(0, 3).forEach(task => {
        recentActivity.push({
            type: 'Ticket',
            name: task.customerName,
            action: `raised a ${task.type || 'complaint'}`,
            time: moment(task.date).fromNow(),
            color: 'red',
            date: new Date(task.date)
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
          { name: 'Tickets', data: ticketsSeries },
          { name: 'Leads', data: leadsSeries }
        ]
      },
      recentActivity: finalRecentActivity
    });

  } catch (error) {
    console.error("Manager Dashboard Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

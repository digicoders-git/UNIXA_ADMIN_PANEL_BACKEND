
import moment from "moment-timezone";
import Customer from "../models/Customer.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";

// Get dashboard stats for Employee/Manager Panel
export const getEmployeeDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();
    const startOfToday = now.clone().startOf("day").toDate();

    // 1. Fetch all customers to aggregate complaints
    // Note: In a large scale app, we should use aggregate on Customer collection directly
    const customers = await Customer.find({ "complaints.0": { $exists: true } }).select("complaints name mobile address");

    // Flatten complaints
    let allComplaints = [];
    customers.forEach(customer => {
      if (customer.complaints && customer.complaints.length > 0) {
        customer.complaints.forEach(complaint => {
          allComplaints.push({
            ...complaint.toObject(),
            customerName: customer.name,
            customerMobile: customer.mobile,
            customerAddress: customer.address ? `${customer.address.area}, ${customer.address.city}` : "Unknown"
          });
        });
      }
    });

    // Sort complaints by date descending
    allComplaints.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Stats
    const totalTickets = allComplaints.length;
    const pendingJobs = allComplaints.filter(c => c.status !== "Resolved").length;
    const completedJobs = allComplaints.filter(c => c.status === "Resolved").length;
    
    // New Leads (Enquiries)
    const totalEnquiries = await Enquiry.countDocuments();
    // Assuming "New Leads" means created in last 7 days or status=New. Let's start with created recently.
    // Or simpler: just total active/new enquiries.
    // Let's use Enquiry count for "New Leads" card as requested in UI "New Leads".
    // UI shows "18", implying a small number, maybe recent? 
    // Let's count enquiries from last 30 days for "New Leads" metric, or just all "Unread".
    const newLeadsCount = await Enquiry.countDocuments({ createdAt: { $gte: now.clone().subtract(30, 'days').toDate() } });


    // Weekly Performance (Last 7 Days)
    // Group complaints by date
    const ticketsPerDay = {};
    const leadsPerDay = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD");
      ticketsPerDay[dateStr] = 0;
      leadsPerDay[dateStr] = 0;
    }

    // Process Tickets
    allComplaints.forEach(c => {
      const dateStr = moment(c.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (ticketsPerDay[dateStr] !== undefined) {
        ticketsPerDay[dateStr]++;
      }
    });

    // Process Leads
    const recentEnquiries = await Enquiry.find({ createdAt: { $gte: last7Days } });
    recentEnquiries.forEach(e => {
      const dateStr = moment(e.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (leadsPerDay[dateStr] !== undefined) {
        leadsPerDay[dateStr]++;
      }
    });

    const chartCategories = Object.keys(ticketsPerDay).sort().map(date => moment(date).format("ddd")); // Mon, Tue...
    // Ensure keys are sorted before mapping values
    const sortedDates = Object.keys(ticketsPerDay).sort();
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);


    // Recent Tasks (Top 5 pending/ongoing complaints)
    const recentTasks = allComplaints
      .filter(c => c.status !== "Resolved")
      .slice(0, 5)
      .map(task => ({
        id: task.complaintId || "N/A",
        customer: task.customerName,
        type: task.type,
        status: task.status,
        priority: task.priority,
        time: moment(task.date).fromNow(),
        isUrgent: task.priority === "High",
        isNew: moment(task.date).isAfter(startOfToday)
      }));

    res.json({
      stats: {
        totalTickets,
        pendingJobs,
        completedJobs,
        newLeads: newLeadsCount
      },
      chart: {
        categories: chartCategories,
        series: [
          { name: 'Tickets', data: ticketsSeries },
          { name: 'Leads', data: leadsSeries }
        ]
      },
      recentTasks
    });

  } catch (error) {
    console.error("Employee Dashboard Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

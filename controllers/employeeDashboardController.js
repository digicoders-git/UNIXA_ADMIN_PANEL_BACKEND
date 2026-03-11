import moment from "moment-timezone";
import AssignedTicket from "../models/AssignedTicket.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Enquiry from "../models/Enquiry.js";
import Customer from "../models/Customer.js";
import Lead from "../models/Lead.js";

// Get dashboard stats for Employee/Manager Panel
export const getEmployeeDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();
    const last30Days = now.clone().subtract(30, 'days').toDate();
    const startOfToday = now.clone().startOf("day").toDate();

    // Get employee name from token (if available) or query param
    const employeeName = req.user?.name || req.query.employeeName;

    // Build query filter for employee-specific data
    const employeeFilter = employeeName ? { assignedTo: employeeName } : {};

    // 1. Parallel counts for efficiency - EMPLOYEE SPECIFIC
    const [
      totalAssigned,
      pendingAssigned,
      completedAssigned,
      newLeadsCount
    ] = await Promise.all([
      AssignedTicket.countDocuments(employeeFilter),
      AssignedTicket.countDocuments({ ...employeeFilter, status: { $nin: ["Completed", "Resolved"] } }),
      AssignedTicket.countDocuments({ ...employeeFilter, status: { $in: ["Completed", "Resolved"] } }),
      Lead.countDocuments({ createdAt: { $gte: last30Days } })
    ]);

    const totalTickets = totalAssigned;
    const pendingJobs = pendingAssigned;
    const completedJobs = completedAssigned;

    // 2. Fetch data for last 7 days ONLY (for charts) - EMPLOYEE SPECIFIC
    const [recentAssigned, recentLeads] = await Promise.all([
      AssignedTicket.find({ ...employeeFilter, createdAt: { $gte: last7Days } }).select('createdAt').lean(),
      Lead.find({ createdAt: { $gte: last7Days } }).select('createdAt').lean()
    ]);

    // 3. Prepare chart data
    const ticketsPerDay = {};
    const leadsPerDay = {};

    for (let i = 0; i < 7; i++) {
      const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD");
      ticketsPerDay[dateStr] = 0;
      leadsPerDay[dateStr] = 0;
    }

    recentAssigned.forEach(t => {
      const dateStr = moment(t.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (ticketsPerDay[dateStr] !== undefined) ticketsPerDay[dateStr]++;
    });
    recentLeads.forEach(e => {
      const dateStr = moment(e.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (leadsPerDay[dateStr] !== undefined) leadsPerDay[dateStr]++;
    });

    const sortedDates = Object.keys(ticketsPerDay).sort();
    const chartCategories = sortedDates.map(date => moment(date).format("ddd"));
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);

    // 4. Recent Tasks - EMPLOYEE SPECIFIC
    const recentAssignedTasks = await AssignedTicket.find({ 
      ...employeeFilter, 
      status: { $nin: ["Completed", "Resolved"] } 
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentTasks = recentAssignedTasks.map(task => ({
      id: task._id,
      customer: task.customerName || "Unknown",
      type: task.title || task.ticketType || "Service",
      status: task.status,
      priority: task.priority || "Medium",
      time: moment(task.createdAt).fromNow(),
      isUrgent: task.priority === "High",
      isNew: moment(task.createdAt).isAfter(startOfToday)
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

export const getEmployeeComplaints = async (req, res) => {
  try {
    // Get employee name from auth token
    const employeeName = req.user?.name || req.user?.email;

    // Fetch assigned tickets for this employee
    const assignedTickets = await AssignedTicket.find({ assignedTo: employeeName })
      .select('ticketId title description priority status dueDate customerName customerPhone customerEmail address createdAt ticketType')
      .sort({ createdAt: -1 })
      .lean();

    const complaints = assignedTickets.map(ticket => ({
      ticketId: ticket.ticketId || `TKT-${ticket._id}`,
      customerName: ticket.customerName || 'Unknown',
      customerMobile: ticket.customerPhone || 'N/A',
      customerEmail: ticket.customerEmail || 'N/A',
      address: ticket.address || 'N/A',
      type: ticket.title || ticket.ticketType || 'Service',
      priority: ticket.priority || 'Medium',
      status: ticket.status || 'Pending',
      date: ticket.createdAt || ticket.dueDate,
      description: ticket.description || 'No description',
      source: 'Admin',
      scheduledDate: ticket.dueDate || '',
      preferredTime: ''
    }));

    res.json({ complaints });
  } catch (error) {
    console.error("Get Employee Complaints Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getTicketTypes = async (req, res) => {
  try {
    const ticketTypes = Customer.schema.path('complaints').schema.path('type').enumValues;
    res.json({ ticketTypes });
  } catch (error) {
    console.error("Get Ticket Types Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getTicketMetadata = async (req, res) => {
  try {
    const priorities = Customer.schema.path('complaints').schema.path('priority').enumValues;
    const statuses = Customer.schema.path('complaints').schema.path('status').enumValues;
    const sources = ['Phone', 'Email', 'Whatsapp', 'Walk-in', 'Website'];

    res.json({ priorities, statuses, sources });
  } catch (error) {
    console.error("Get Ticket Metadata Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const createComplaint = async (req, res) => {
  try {
    const {
      customerMobile,
      type,
      priority,
      description,
      status,
      scheduledDate,
      preferredTime,
      source,
      assignedTechnician,
      resolutionNotes
    } = req.body;

    if (!customerMobile || !type || !description) {
      return res.status(400).json({ message: "Customer mobile, type, and description are required" });
    }

    const customer = await Customer.findOne({ mobile: customerMobile });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const newComplaint = {
      complaintId: `TKT-${Date.now().toString().slice(-6)}`,
      type,
      description,
      date: new Date(),
      priority: priority || "Medium",
      status: status || "Open",
      assignedTechnician: assignedTechnician || "",
      resolutionNotes: resolutionNotes || ""
    };

    customer.complaints.push(newComplaint);
    await customer.save();

    res.status(201).json({
      message: "Complaint created successfully",
      complaint: {
        ticketId: newComplaint.complaintId,
        customerName: customer.name,
        customerMobile: customer.mobile,
        type: newComplaint.type,
        priority: newComplaint.priority,
        status: newComplaint.status,
        date: newComplaint.date,
        description: newComplaint.description,
        assignedTechnician: newComplaint.assignedTechnician,
        resolutionNotes: newComplaint.resolutionNotes,
        source: source || "Phone",
        scheduledDate: scheduledDate || "",
        preferredTime: preferredTime || ""
      }
    });
  } catch (error) {
    console.error("Create Complaint Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { type, priority, description, status, assignedTechnician, resolutionNotes } = req.body;

    const customer = await Customer.findOne({ "complaints.complaintId": complaintId });
    if (!customer) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const complaint = customer.complaints.find(c => c.complaintId === complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (type) complaint.type = type;
    if (priority) complaint.priority = priority;
    if (description) complaint.description = description;
    if (status) complaint.status = status;
    if (assignedTechnician !== undefined) complaint.assignedTechnician = assignedTechnician;
    if (resolutionNotes !== undefined) complaint.resolutionNotes = resolutionNotes;

    await customer.save();

    res.json({
      message: "Complaint updated successfully",
      complaint: {
        ticketId: complaint.complaintId,
        customerName: customer.name,
        customerMobile: customer.mobile,
        type: complaint.type,
        priority: complaint.priority,
        status: complaint.status,
        date: complaint.date,
        description: complaint.description,
        assignedTechnician: complaint.assignedTechnician,
        resolutionNotes: complaint.resolutionNotes
      }
    });
  } catch (error) {
    console.error("Update Complaint Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const customer = await Customer.findOne({ "complaints.complaintId": complaintId });
    if (!customer) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    customer.complaints = customer.complaints.filter(c => c.complaintId !== complaintId);
    await customer.save();

    res.json({ message: "Complaint deleted successfully" });
  } catch (error) {
    console.error("Delete Complaint Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

import moment from "moment-timezone";
import AssignedTicket from "../models/AssignedTicket.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Enquiry from "../models/Enquiry.js";
import Customer from "../models/Customer.js";

// Get dashboard stats for Employee/Manager Panel
export const getEmployeeDashboardStats = async (req, res) => {
  try {
    const now = moment().tz("Asia/Kolkata");
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();
    const startOfToday = now.clone().startOf("day").toDate();

    // Fetch all tickets (AssignedTickets + ServiceRequests)
    const assignedTickets = await AssignedTicket.find().sort({ createdAt: -1 });
    const serviceRequests = await ServiceRequest.find().sort({ createdAt: -1 });

    const allTickets = [...assignedTickets, ...serviceRequests];
    const totalTickets = allTickets.length;
    const pendingJobs = allTickets.filter(t => t.status !== "Completed" && t.status !== "Resolved").length;
    const completedJobs = allTickets.filter(t => t.status === "Completed" || t.status === "Resolved").length;
    const newLeadsCount = await Enquiry.countDocuments({ createdAt: { $gte: now.clone().subtract(30, 'days').toDate() } });

    const ticketsPerDay = {};
    const leadsPerDay = {};

    for (let i = 0; i < 7; i++) {
      const dateStr = now.clone().subtract(i, "days").format("YYYY-MM-DD");
      ticketsPerDay[dateStr] = 0;
      leadsPerDay[dateStr] = 0;
    }

    allTickets.forEach(t => {
      const dateStr = moment(t.createdAt || t.date).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (ticketsPerDay[dateStr] !== undefined) {
        ticketsPerDay[dateStr]++;
      }
    });

    const recentEnquiries = await Enquiry.find({ createdAt: { $gte: last7Days } });
    recentEnquiries.forEach(e => {
      const dateStr = moment(e.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (leadsPerDay[dateStr] !== undefined) {
        leadsPerDay[dateStr]++;
      }
    });

    const chartCategories = Object.keys(ticketsPerDay).sort().map(date => moment(date).format("ddd"));
    const sortedDates = Object.keys(ticketsPerDay).sort();
    const ticketsSeries = sortedDates.map(date => ticketsPerDay[date]);
    const leadsSeries = sortedDates.map(date => leadsPerDay[date]);

    const recentTasks = allTickets
      .filter(t => t.status !== "Completed" && t.status !== "Resolved")
      .slice(0, 5)
      .map(task => ({
        id: task.ticketId || task._id,
        customer: task.customerName || "Unknown",
        type: task.type || task.ticketType || "Service",
        status: task.status,
        priority: task.priority || "Medium",
        time: moment(task.createdAt || task.date).fromNow(),
        isUrgent: task.priority === "High",
        isNew: moment(task.createdAt || task.date).isAfter(startOfToday)
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
    const customers = await Customer.find({ "complaints.0": { $exists: true } }).select("complaints name mobile address");

    let allComplaints = [];
    customers.forEach(customer => {
      if (customer.complaints && customer.complaints.length > 0) {
        customer.complaints.forEach(complaint => {
          allComplaints.push({
            ticketId: complaint.complaintId || `TKT-${complaint._id}`,
            customerName: customer.name,
            customerMobile: customer.mobile,
            type: complaint.type,
            priority: complaint.priority || "Medium",
            status: complaint.status,
            date: complaint.date,
            description: complaint.description,
            source: "Phone",
            scheduledDate: "",
            preferredTime: ""
          });
        });
      }
    });

    allComplaints.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ complaints: allComplaints });
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

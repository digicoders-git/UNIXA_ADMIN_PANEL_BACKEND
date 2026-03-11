import Lead from "../models/Lead.js";
import AssignedTicket from "../models/AssignedTicket.js";

export const createLead = async (req, res) => {
  try {
    const { name, email, phone, address, productInterest, leadStatus, notes, followUpDate, source } = req.body;
    let { createdBy } = req.body;

    // Use name from auth token if available and createdBy is not provided
    if (!createdBy && req.user && req.user.name) {
      createdBy = req.user.name;
    }

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      address,
      productInterest,
      leadStatus: leadStatus || 'Warm',
      notes,
      followUpDate,
      source: source || 'Field Visit',
      createdBy: createdBy || "Unknown"
    });

    // Automatically create a ticket if lead is created by an employee
    const isEmployee = req.user && (req.user.role === 'Employee' || req.user.role === 'Manager');
    const creatorName = createdBy || (req.user && req.user.name);

    if (isEmployee && creatorName) {
      await AssignedTicket.create({
        ticketType: 'lead',
        leadId: lead._id,
        title: `Self Assigned Lead: ${name}`,
        description: `Lead created by ${creatorName}. Product interest: ${productInterest || "N/A"}`,
        assignedBy: "System",
        assignedTo: creatorName,
        priority: 'Medium',
        status: 'Pending',
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        address: address
      });
    }

    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (err) {
    console.error("createLead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listLeads = async (_req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json({ leads });
  } catch (err) {
    console.error("listLeads error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getLead = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (err) {
    console.error("getLead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, productInterest, leadStatus, notes, followUpDate } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (name) lead.name = name;
    if (email !== undefined) lead.email = email;
    if (phone) lead.phone = phone;
    if (address !== undefined) lead.address = address;
    if (productInterest !== undefined) lead.productInterest = productInterest;
    if (leadStatus) lead.leadStatus = leadStatus;
    if (notes !== undefined) lead.notes = notes;
    if (followUpDate !== undefined) lead.followUpDate = followUpDate;

    await lead.save();
    res.json({ message: "Lead updated successfully", lead });
  } catch (err) {
    console.error("updateLead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("deleteLead error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

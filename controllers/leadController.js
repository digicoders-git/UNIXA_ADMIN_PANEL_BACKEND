import Lead from "../models/Lead.js";
import AssignedTicket from "../models/AssignedTicket.js";

export const createLead = async (req, res) => {
  try {
    const { name, email, phone, address, productInterest, selectedItem, leadStatus, notes, followUpDate, source } = req.body;
    let { createdBy } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    // Use name from auth token if available and createdBy is not provided
    if (!createdBy && req.user && req.user.name) {
      createdBy = req.user.name;
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      address,
      productInterest,
      selectedItem: selectedItem || null,
      leadStatus: leadStatus || 'Warm',
      notes,
      followUpDate,
      source: source || 'Field Visit',
      createdBy: createdBy || "Unknown",
      assignedTo: null,
      status: 'Pending'
    });

    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (err) {
    console.error("createLead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listLeads = async (req, res) => {
  try {
    const filter = {};
    // Employee sirf apne leads dekhe
    if (req.user && req.user.role === 'Employee') {
      filter.createdBy = req.user.name;
    }
    const leads = await Lead.find(filter).populate('assignedTo', 'name email').sort({ createdAt: -1 });
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
    const { name, email, phone, address, productInterest, leadStatus, notes, followUpDate, status } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // Permission check: Only admin, assigned employee, or manager can update
    if (req.user && req.user.role !== 'Admin') {
      if (lead.assignedTo && lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this lead" });
      }
    }

    // Prevent reassignment of already assigned leads
    if (lead.assignedTo && lead.assignedTo.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: "This lead is already assigned and cannot be reassigned" });
    }

    if (name) lead.name = name;
    if (email !== undefined) lead.email = email;
    if (phone) lead.phone = phone;
    if (address !== undefined) lead.address = address;
    if (productInterest !== undefined) lead.productInterest = productInterest;
    if (leadStatus) lead.leadStatus = leadStatus;
    if (notes !== undefined) lead.notes = notes;
    if (followUpDate !== undefined) lead.followUpDate = followUpDate;
    if (status) lead.status = status;

    await lead.save();
    res.json({ message: "Lead updated successfully", lead });
  } catch (err) {
    console.error("updateLead error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyLead = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    lead.verified = !lead.verified;
    await lead.save();
    res.json({ message: `Lead ${lead.verified ? 'verified' : 'unverified'} successfully`, lead });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const scheduleService = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, scheduleNote } = req.body;
    if (!scheduledDate) return res.status(400).json({ message: "Scheduled date is required" });
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    lead.serviceSchedule = { scheduledDate, scheduleStatus: "Upcoming", scheduleNote: scheduleNote || "" };
    await lead.save();
    res.json({ message: "Service scheduled successfully", lead });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduleStatus } = req.body;
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    lead.serviceSchedule.scheduleStatus = scheduleStatus;
    await lead.save();
    res.json({ message: "Schedule status updated", lead });
  } catch (err) {
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

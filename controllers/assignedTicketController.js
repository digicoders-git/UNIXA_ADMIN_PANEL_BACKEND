import mongoose from 'mongoose';
import AssignedTicket from '../models/AssignedTicket.js';
import UserAmc from '../models/UserAmc.js';
import User from '../models/User.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Order from '../models/Order.js';
import Lead from '../models/Lead.js';

// Create ticket
export const createTicket = async (req, res) => {
  try {
    const { ticketType, title, assignedBy, assignedTo, leadId } = req.body;

    // Quick validation log
    console.log(`[createTicket] Type: ${ticketType}, Title: ${title}, By: ${assignedBy}, To: ${assignedTo}`);
    if (ticketType === 'lead') {
      console.log(`[createTicket] Lead ID: ${leadId}`);
    }

    // Manual check for missing fields often causing issues
    if (!ticketType || !title || !assignedBy || !assignedTo) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: { ticketType, title, assignedBy, assignedTo }
      });
    }

    // Lead ID format check if present
    if (req.body.leadId && !mongoose.Types.ObjectId.isValid(req.body.leadId)) {
      console.error('Invalid Lead ID format:', req.body.leadId);
      return res.status(400).json({ message: 'Invalid Lead ID format' });
    }

    const ticket = await AssignedTicket.create(req.body);
    console.log(`[createTicket] ✅ Ticket created successfully:`, {
      id: ticket._id,
      type: ticket.ticketType,
      leadId: ticket.leadId,
      status: ticket.status,
      assignedTo: ticket.assignedTo
    });
    res.status(201).json({ message: 'Ticket assigned successfully', ticket });
  } catch (error) {
    console.error('CRITICAL: Error in createTicket:', error);
    res.status(500).json({
      message: 'Server error while assigning ticket',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all tickets
export const getAllTickets = async (req, res) => {
  try {
    const tickets = await AssignedTicket.find()
      .select('ticketType title assignedTo assignedBy priority dueDate status description customerName customerPhone customerEmail address createdAt serviceRequestId orderId userId amcId leadId')
      .sort({ createdAt: -1 })
      .lean();
    
    // Convert ObjectId to string for leadId to ensure frontend comparison works
    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      leadId: ticket.leadId ? ticket.leadId.toString() : ticket.leadId
    }));
    
    res.json(formattedTickets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
};

// Get tickets by employee name - optimized for faster response
export const getTicketsByEmployee = async (req, res) => {
  try {
    const { employeeName } = req.params;
    const decodedEmployeeName = decodeURIComponent(employeeName).trim();
    console.log(`[${new Date().toISOString()}] Fetching tickets for employee: "${decodedEmployeeName}"`);

    // Simple exact match (fastest)
    const tickets = await AssignedTicket.find({ assignedTo: decodedEmployeeName })
      .select('ticketType title assignedTo assignedBy priority dueDate status description customerName customerPhone customerEmail address createdAt notes')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`[${new Date().toISOString()}] Found ${tickets.length} tickets for "${decodedEmployeeName}"`);
    
    res.json(tickets);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching tickets:`, error.message);
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
};

// Update ticket
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await AssignedTicket.findByIdAndUpdate(id, req.body, { new: true })
      .populate('userId', 'firstName lastName email phone addresses')
      .populate('amcId')
      .populate('serviceRequestId')
      .populate('orderId')
      .populate('leadId');
    res.json({ message: 'Ticket updated', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error updating ticket', error: error.message });
  }
};

// Complete ticket with photo
export const completeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { completionPhoto } = req.body;

    const ticket = await AssignedTicket.findById(id)
      .populate('amcId')
      .populate('serviceRequestId')
      .populate('orderId');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.status = 'Completed';
    ticket.completionPhoto = completionPhoto;
    ticket.completedAt = new Date();
    await ticket.save();

    // Handle based on ticket type
    if (ticket.ticketType === 'service_request') {
      // Update AMC servicesUsed if amcId is present
      if (ticket.amcId) {
        const amc = await UserAmc.findById(ticket.amcId);
        if (amc && amc.servicesUsed < amc.servicesTotal) {
          amc.servicesUsed += 1;
          amc.serviceHistory.push({
            date: new Date(),
            type: 'Regular Service',
            technicianName: ticket.assignedTo,
            notes: `Completed ticket: ${ticket.title}${ticket.notes ? ' - ' + ticket.notes : ''}`,
            complaintId: ticket._id.toString()
          });
          await amc.save();
        }
      }

      // Update ServiceRequest status if linked
      if (ticket.serviceRequestId) {
        await ServiceRequest.findByIdAndUpdate(ticket.serviceRequestId, {
          status: 'Resolved',
          assignedTechnician: ticket.assignedTo,
          completionPhoto: completionPhoto
        });
      }
    } else if (ticket.ticketType === 'order' && ticket.orderId) {
      // Update Order status to delivered
      await Order.findByIdAndUpdate(ticket.orderId, {
        status: 'delivered',
        deliveredAt: new Date()
      });
    }

    res.json({ message: 'Ticket completed successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error completing ticket', error: error.message });
  }
};

// Delete ticket
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    await AssignedTicket.findByIdAndDelete(id);
    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting ticket', error: error.message });
  }
};

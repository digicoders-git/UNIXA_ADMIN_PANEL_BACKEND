import AssignedTicket from '../models/AssignedTicket.js';
import UserAmc from '../models/UserAmc.js';
import User from '../models/User.js';
import ServiceRequest from '../models/ServiceRequest.js';
import Order from '../models/Order.js';

// Create ticket
export const createTicket = async (req, res) => {
  try {
    const ticket = await AssignedTicket.create(req.body);
    res.status(201).json({ message: 'Ticket assigned successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error creating ticket', error: error.message });
  }
};

// Get all tickets
export const getAllTickets = async (req, res) => {
  try {
    const tickets = await AssignedTicket.find()
      .populate('userId', 'firstName lastName email phone addresses')
      .populate('amcId')
      .populate('serviceRequestId')
      .populate('orderId')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
};

// Get tickets by employee name
export const getTicketsByEmployee = async (req, res) => {
  try {
    const { employeeName } = req.params;
    const tickets = await AssignedTicket.find({ assignedTo: employeeName })
      .populate('userId', 'firstName lastName email phone addresses')
      .populate('amcId')
      .populate('serviceRequestId')
      .populate('orderId')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
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
      .populate('orderId');
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
    if (ticket.ticketType === 'service_request' && ticket.serviceRequestId) {
      // Update AMC servicesUsed ONLY for service request tickets
      if (ticket.amcId) {
        const amc = await UserAmc.findById(ticket.amcId);
        if (amc && amc.servicesUsed < amc.servicesTotal) {
          amc.servicesUsed += 1;

          amc.serviceHistory.push({
            date: new Date(),
            type: 'Regular Service',
            technicianName: ticket.assignedTo,
            notes: `Completed ticket: ${ticket.title}`,
            complaintId: ticket._id.toString()
          });

          await amc.save();
        }
      }

      // Update ServiceRequest status
      await ServiceRequest.findByIdAndUpdate(ticket.serviceRequestId, {
        status: 'Resolved',
        assignedTechnician: ticket.assignedTo,
        completionPhoto: completionPhoto
      });
    } else if (ticket.ticketType === 'order' && ticket.orderId) {
      // Update Order status to delivered (NO AMC service count change)
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

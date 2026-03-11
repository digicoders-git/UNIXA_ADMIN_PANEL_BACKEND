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
    const { ticketType, title, assignedBy, assignedTo, leadId, orderId, serviceRequestId } = req.body;

    // Quick validation log
    console.log(`[createTicket] Type: ${ticketType}, Title: ${title}, By: ${assignedBy}, To: ${assignedTo}`);
    console.log(`[createTicket] OrderID: ${orderId}, ServiceRequestID: ${serviceRequestId}, LeadID: ${leadId}`);

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
      orderId: ticket.orderId,
      serviceRequestId: ticket.serviceRequestId,
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
      // Find the AMC to update
      let amcToUpdate = null;
      let amcIdToUse = ticket.amcId;

      // If amcId is missing on ticket, try to get it from the service request
      if (!amcIdToUse && ticket.serviceRequestId) {
        amcIdToUse = ticket.serviceRequestId.amcId;
        console.log(`[completeTicket] Retrieved amcId from service request: ${amcIdToUse}`);
      }

      if (amcIdToUse) {
        // If amcIdToUse is already a document (from populate), use it; otherwise find it
        if (amcIdToUse._id) {
          amcToUpdate = await UserAmc.findById(amcIdToUse._id);
        } else {
          amcToUpdate = await UserAmc.findById(amcIdToUse);
        }

        if (amcToUpdate) {
          console.log(`[completeTicket] Updating AMC: ${amcToUpdate._id}, current used: ${amcToUpdate.servicesUsed}`);
          amcToUpdate.servicesUsed += 1;
          amcToUpdate.serviceHistory.push({
            date: new Date(),
            type: 'Regular Service',
            technicianName: ticket.assignedTo,
            notes: `Completed ticket: ${ticket.title}${ticket.notes ? ' - ' + ticket.notes : ''}`,
            complaintId: ticket._id.toString()
          });
          await amcToUpdate.save();
          console.log(`[completeTicket] AMC updated successfully. New used count: ${amcToUpdate.servicesUsed}`);
        } else {
          console.warn(`[completeTicket] AMC document not found for ID: ${amcIdToUse}`);
        }
      } else {
        console.warn(`[completeTicket] No amcId found for ticket: ${ticket._id}`);
      }

      // Update ServiceRequest status if linked
      if (ticket.serviceRequestId) {
        await ServiceRequest.findByIdAndUpdate(ticket.serviceRequestId, {
          status: 'Resolved',
          assignedTechnician: ticket.assignedTo,
          completionPhoto: completionPhoto
        });
        console.log(`[completeTicket] ServiceRequest ${ticket.serviceRequestId._id || ticket.serviceRequestId} marked as Resolved`);
      }
    } else if (ticket.ticketType === 'order' && ticket.orderId) {
      // Update Order status to installed
      await Order.findByIdAndUpdate(ticket.orderId, {
        status: 'installed',
        installedAt: new Date(),
        installedBy: ticket.assignedTo
      });
      console.log(`[completeTicket] Order ${ticket.orderId._id || ticket.orderId} marked as installed`);
    }

    res.json({ message: 'Ticket completed successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error completing ticket', error: error.message });
  }
};

// Get available orders for assignment (not already assigned)
export const getAvailableOrders = async (req, res) => {
  try {
    // Get all assigned tickets with order IDs that are NOT cancelled
    // Removing ticketType filter to be more robust - if an order is assigned to ANY ticket, it shouldn't show up
    const assignedTickets = await AssignedTicket.find({ 
      orderId: { $exists: true, $ne: null },
      status: { $ne: 'Cancelled' }
    }).select('orderId').lean();
    
    // Extract order IDs and convert to strings for comparison
    const assignedOrderIds = assignedTickets
      .map(ticket => ticket.orderId ? ticket.orderId.toString() : null)
      .filter(id => id !== null);
    
    console.log('Assigned Order IDs (Active):', assignedOrderIds);
    
    // Get all delivered orders
    const allDeliveredOrders = await Order.find({
      status: 'delivered'
    })
    .select('_id shippingAddress total createdAt status userId')
    .sort({ createdAt: -1 })
    .lean();
    
    // Filter out assigned orders
    const availableOrders = allDeliveredOrders.filter(order => 
      !assignedOrderIds.includes(order._id.toString())
    );
    
    console.log('Total Delivered Orders:', allDeliveredOrders.length);
    console.log('Available Orders Count:', availableOrders.length);
    
    res.json(availableOrders);
  } catch (error) {
    console.error('Error in getAvailableOrders:', error);
    res.status(500).json({ message: 'Error fetching available orders', error: error.message });
  }
};

// Get available service requests for assignment (not already assigned)
export const getAvailableServiceRequests = async (req, res) => {
  try {
    // Get all active assigned tickets (not cancelled) with service request IDs
    // Removing ticketType filter to be more robust
    const assignedTickets = await AssignedTicket.find({ 
      serviceRequestId: { $exists: true, $ne: null },
      status: { $ne: 'Cancelled' }
    }).select('serviceRequestId').lean();
    
    // Extract service request IDs and convert to strings for comparison
    const assignedServiceRequestIds = assignedTickets
      .map(ticket => ticket.serviceRequestId ? ticket.serviceRequestId.toString() : null)
      .filter(id => id !== null);
    
    console.log('Assigned Service Request IDs (Active):', assignedServiceRequestIds);
    
    // Get all open service requests
    const allOpenRequests = await ServiceRequest.find({
      status: 'Open'
    })
    .select('_id ticketId customerName customerPhone customerEmail type address createdAt status amcId userId')
    .sort({ createdAt: -1 })
    .lean();
    
    // Filter out assigned service requests
    const availableRequests = allOpenRequests.filter(request => 
      !assignedServiceRequestIds.includes(request._id.toString())
    );
    
    console.log('Total Open Service Requests:', allOpenRequests.length);
    console.log('Available Service Requests Count:', availableRequests.length);
    
    res.json(availableRequests);
  } catch (error) {
    console.error('Error in getAvailableServiceRequests:', error);
    res.status(500).json({ message: 'Error fetching available service requests', error: error.message });
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

// Debug endpoint to check all assigned tickets
export const debugAssignedTickets = async (req, res) => {
  try {
    const tickets = await AssignedTicket.find()
      .select('ticketType orderId serviceRequestId title status createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    const orderTickets = tickets.filter(t => t.ticketType === 'order' && t.orderId);
    const serviceTickets = tickets.filter(t => t.ticketType === 'service_request' && t.serviceRequestId);
    
    res.json({
      totalTickets: tickets.length,
      orderTickets: orderTickets.map(t => ({ 
        id: t._id.toString(), 
        orderId: t.orderId?.toString(), 
        title: t.title, 
        status: t.status,
        created: t.createdAt
      })),
      serviceTickets: serviceTickets.map(t => ({ 
        id: t._id.toString(), 
        serviceRequestId: t.serviceRequestId?.toString(), 
        title: t.title, 
        status: t.status,
        created: t.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Debug error', error: error.message });
  }
};

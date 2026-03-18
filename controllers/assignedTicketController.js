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



    if (!ticketType || !title || !assignedBy || !assignedTo) {
      return res.status(400).json({
        message: 'Missing required fields',
        details: { ticketType, title, assignedBy, assignedTo }
      });
    }

    if (req.body.leadId && !mongoose.Types.ObjectId.isValid(req.body.leadId)) {

      return res.status(400).json({ message: 'Invalid Lead ID format' });
    }

    if (ticketType === 'lead' && leadId) {
      const existingLeadTicket = await AssignedTicket.findOne({
        ticketType: 'lead',
        leadId: leadId,
        status: { $ne: 'Cancelled' }
      });
      if (existingLeadTicket) {

        return res.status(400).json({
          message: 'This lead is already assigned to another employee',
          existingTicket: existingLeadTicket._id
        });
      }
    }

    const ticket = await AssignedTicket.create(req.body);

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
      .populate('orderId')
      .populate('serviceRequestId')
      .sort({ createdAt: -1 })
      .lean();



    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      leadId: ticket.leadId ? ticket.leadId.toString() : ticket.leadId
    }));

    res.json(formattedTickets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
};

// Get tickets by employee name
export const getTicketsByEmployee = async (req, res) => {
  try {
    const { employeeName } = req.params;
    const decodedEmployeeName = decodeURIComponent(employeeName).trim();


    const tickets = await AssignedTicket.find({ assignedTo: decodedEmployeeName })
      .select('ticketType title assignedTo assignedBy priority dueDate status description customerName customerPhone customerEmail address createdAt notes visitType')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();



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
    const { completionPhotos, completionRemark, employeeFeedback, customerFeedback } = req.body;

    const ticket = await AssignedTicket.findById(id)
      .populate('amcId')
      .populate('serviceRequestId')
      .populate('orderId');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.status = 'Completed';
    ticket.completionPhotos = completionPhotos;
    ticket.completionRemark = completionRemark;
    ticket.employeeFeedback = employeeFeedback;
    ticket.customerFeedback = customerFeedback;
    ticket.visitPhotos = completionPhotos;
    ticket.completedAt = new Date();
    await ticket.save();

    if (ticket.ticketType === 'service_request') {
      let amcToUpdate = null;
      let amcIdToUse = ticket.amcId;

      if (!amcIdToUse && ticket.serviceRequestId) {
        amcIdToUse = ticket.serviceRequestId.amcId;
        console.log(`[completeTicket] Retrieved amcId from service request: ${amcIdToUse}`);
      }

      if (amcIdToUse) {
        if (amcIdToUse._id) {
          amcToUpdate = await UserAmc.findById(amcIdToUse._id);
        } else {
          amcToUpdate = await UserAmc.findById(amcIdToUse);
        }

        if (amcToUpdate) {
          if (ticket.visitType === 'AMC_REMINDER') {
            const reminderIndex = amcToUpdate.reminderHistory.findIndex(r => r.ticketId?.toString() === ticket._id.toString());
            if (reminderIndex !== -1) {
              amcToUpdate.reminderHistory[reminderIndex].status = 'Completed';
              amcToUpdate.reminderHistory[reminderIndex].completedAt = new Date();
              amcToUpdate.reminderHistory[reminderIndex].employeeFeedback = employeeFeedback;
              amcToUpdate.reminderHistory[reminderIndex].visitPhotos = completionPhotos;
              amcToUpdate.reminderHistory[reminderIndex].customerFeedback = customerFeedback;
            }

            amcToUpdate.servicesUsed = (amcToUpdate.servicesUsed || 0) + 1;

            // Next service due = completion date + 4 months
            const completionDate = new Date(ticket.completedAt);
            const interval = amcToUpdate.serviceSchedule?.intervalMonths || 4;
            const nextDue = new Date(completionDate);
            nextDue.setMonth(nextDue.getMonth() + interval);
            amcToUpdate.nextServiceDueDate = nextDue;
            amcToUpdate.reminderSent = false;
            console.log(`[completeTicket] servicesUsed: ${amcToUpdate.servicesUsed}, nextServiceDueDate: ${nextDue}`);

            amcToUpdate.serviceHistory.push({
              date: completionDate,
              type: 'AMC Service',
              technicianName: ticket.assignedTo,
              notes: `Completed AMC Service: ${ticket.title}${ticket.notes ? ' - ' + ticket.notes : ''}`,
              complaintId: ticket._id.toString()
            });
          } else {
            console.log(`[completeTicket] Regular/Customer service request completed, not deducting AMC quota.`);
            const isRegularService = ticket.description && ticket.description.startsWith('Regular');

            amcToUpdate.serviceHistory.push({
              date: new Date(),
              type: isRegularService ? 'Regular Service' : 'AMC Service',
              technicianName: ticket.assignedTo,
              notes: `Completed ticket: ${ticket.title}${ticket.notes ? ' - ' + ticket.notes : ''}`,
              complaintId: ticket._id.toString()
            });
          }
          await amcToUpdate.save();
        } else {
          console.warn(`[completeTicket] AMC document not found for ID: ${amcIdToUse}`);
        }
      } else {
        console.warn(`[completeTicket] No amcId found for ticket: ${ticket._id}`);
      }

      if (ticket.serviceRequestId) {
        await ServiceRequest.findByIdAndUpdate(ticket.serviceRequestId._id || ticket.serviceRequestId, {
          status: 'Resolved',
          assignedTechnician: ticket.assignedTo,
          completionPhotos: completionPhotos,
          completionRemark: completionRemark
        });
        console.log(`[completeTicket] ServiceRequest ${ticket.serviceRequestId._id || ticket.serviceRequestId} marked as Resolved`);
      }
    } else if (ticket.ticketType === 'order' && ticket.orderId) {
      await Order.findByIdAndUpdate(ticket.orderId._id || ticket.orderId, {
        status: 'installed',
        installedAt: new Date(),
        installedBy: ticket.assignedTo,
        installationPhotos: completionPhotos,
        installationRemark: completionRemark
      });
      console.log(`[completeTicket] Order ${ticket.orderId._id || ticket.orderId} marked as installed`);
    }

    res.json({ message: 'Ticket completed successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error completing ticket', error: error.message });
  }
};

// Get available orders for assignment
export const getAvailableOrders = async (req, res) => {
  try {
    const assignedTickets = await AssignedTicket.find({
      orderId: { $exists: true, $ne: null },
      status: { $ne: 'Cancelled' }
    }).select('orderId').lean();

    const assignedOrderIds = assignedTickets
      .map(ticket => ticket.orderId ? ticket.orderId.toString() : null)
      .filter(id => id !== null);

    console.log('Assigned Order IDs (Active):', assignedOrderIds);

    const allDeliveredOrders = await Order.find({
      status: 'delivered'
    })
      .select('_id shippingAddress total createdAt status userId')
      .sort({ createdAt: -1 })
      .lean();

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

// Get available service requests for assignment
export const getAvailableServiceRequests = async (req, res) => {
  try {
    const assignedTickets = await AssignedTicket.find({
      serviceRequestId: { $exists: true, $ne: null },
      status: { $ne: 'Cancelled' }
    }).select('serviceRequestId').lean();

    const assignedServiceRequestIds = assignedTickets
      .map(ticket => ticket.serviceRequestId ? ticket.serviceRequestId.toString() : null)
      .filter(id => id !== null);

    console.log('Assigned Service Request IDs (Active):', assignedServiceRequestIds);

    const allOpenRequests = await ServiceRequest.find({
      status: 'Open'
    })
      .populate('userId', 'firstName lastName email phone addresses')
      .sort({ createdAt: -1 })
      .lean();

    const requestsWithAddress = allOpenRequests.map(request => {
      let finalAddress = request.address;
      if (!finalAddress || finalAddress === 'N/A') {
        const user = request.userId;
        if (user && user.addresses && user.addresses.length > 0) {
          const primaryAddress = user.addresses.find(addr => addr.isDefault || addr.isPrimary) || user.addresses[0];
          finalAddress = `${primaryAddress.addressLine1 || ''}, ${primaryAddress.city || ''}`.trim() || 'N/A';
        }
      }
      return { ...request, address: finalAddress || 'N/A' };
    });

    const availableRequests = requestsWithAddress.filter(request =>
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



import Customer from "../models/Customer.js";
import UserAmc from "../models/UserAmc.js";
import User from "../models/User.js";
import UserNotification from "../models/UserNotification.js";
import Transaction from "../models/Transaction.js";
import Order from "../models/Order.js";
import Lead from "../models/Lead.js";

// Get Complete Customer History (Orders + AMCs)
export const getCustomerCompleteHistory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("getCustomerCompleteHistory called with id:", id);

    let customer = null;
    const mongoose = (await import("mongoose")).default;

    // Try different ways to find customer
    // 1. Try by ObjectId in Customer collection
    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await Customer.findById(id);
    }

    // 2. Try by phone number in Customer collection
    if (!customer) {
      customer = await Customer.findOne({ mobile: id });
    }

    // 3. Try Lead by ObjectId or phone
    if (!customer) {
      const lead = await Lead.findOne(
        mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { phone: id }
      );
      if (lead) {
        customer = {
          _id: lead.phone, // use phone as stable ID for order lookup
          name: lead.name,
          mobile: lead.phone,
          email: lead.email || "",
          address: { house: "", area: lead.address || "", city: "", pincode: "" }
        };
      }
    }

    // 4. Try orders by phone
    if (!customer) {
      const order = await Order.findOne({ "shippingAddress.phone": id });
      if (order) {
        customer = {
          _id: id,
          name: order.shippingAddress.name,
          mobile: id,
          email: order.shippingAddress.email || "",
          address: {
            house: order.shippingAddress.addressLine1 || "",
            area: order.shippingAddress.addressLine2 || "",
            city: order.shippingAddress.city || "",
            pincode: order.shippingAddress.pincode || ""
          }
        };
      }
    }

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Get all orders for this customer (by phone number or customerId)
    const orders = await Order.find({
      $or: [
        { "shippingAddress.phone": customer.mobile || id },
        { customerId: customer._id || id }
      ]
    }).sort({ createdAt: -1 }).lean();

    console.log("Found orders:", orders.length);

    // Get all AMCs for this customer
    let allAmcs = [];

    // 1. Find User by phone to get potential userId
    const user = await User.findOne({ 
      $or: [
        { phone: customer.mobile },
        { phone: { $regex: (customer.mobile || '').replace(/\D/g,'').slice(-10) + '$' } }
      ]
    });
    const userIds = [];
    if (mongoose.Types.ObjectId.isValid(id)) userIds.push(new mongoose.Types.ObjectId(id));
    if (user) userIds.push(user._id);

    // Get order IDs to search by reference (covers offline orders too)
    const orderIds = orders.map(o => o._id);

    // 2. Search in UserAmc collection - by userId OR orderId OR customerPhone
    const orConditions = [];
    if (orderIds.length > 0) orConditions.push({ orderId: { $in: orderIds } });
    if (customer.mobile) orConditions.push({ customerPhone: customer.mobile });
    if (userIds.length > 0) orConditions.push({ userId: { $in: userIds } });

    const userAmcs = orConditions.length > 0
      ? await UserAmc.find({ $or: orConditions }).populate('amcPlanId').sort({ createdAt: -1 }).lean()
      : [];

    // 3. Include AMCs from Customer model (Manual entries) - ONLY if actually taken
    // Convert Mongoose document to plain object if needed
    const customerObj = typeof customer.toObject === 'function' ? customer.toObject() : customer;

    if (customerObj.amcDetails && customerObj.amcDetails.planName && customerObj.amcDetails.status !== 'Not Taken') {
      allAmcs.push({
        ...customerObj.amcDetails,
        source: "Manual"
      });
    }

    // Include archived AMC history from Customer model - ONLY actual taken AMCs
    if (customerObj.amcHistory && Array.isArray(customerObj.amcHistory)) {
      customerObj.amcHistory.forEach(h => {
        if (h.planName && h.status !== 'Not Taken') {
          allAmcs.push({
            ...h,
            source: "Manual History"
          });
        }
      });
    }

    // Merge UserAmcs into allAmcs
    userAmcs.forEach(amc => {
      allAmcs.push({
        ...amc,
        source: "Online"
      });
    });

    console.log("Total consolidated AMCs:", allAmcs.length);

    // Format orders data - each item as separate row for AMC matching
    const formattedOrders = orders.flatMap(order =>
      (order.items || []).map(item => ({
        _id: order._id,
        product: item.product,
        productType: item.productType || 'Product',
        productName: item.productName || 'N/A',
        productImage: item.productImage,
        quantity: item.quantity || 1,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        source: order.source || 'online',
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        orderId: order._id,
        items: order.items
      }))
    );

    // Format consolidated AMCs data - ONLY include AMCs that were actually purchased/taken
    const formattedAmcs = allAmcs
      .filter(amc => {
        const hasValidPlan = amc.amcPlanName || amc.planName;
        const hasValidStatus = amc.status && amc.status !== 'Not Taken';
        const hasValidDates = amc.startDate && amc.endDate;
        return hasValidPlan && hasValidStatus && hasValidDates;
      })
      .map(amc => ({
        _id: amc._id || amc.amcId,
        productId: amc.productId,
        productName: amc.productName || amc.planName,
        amcPlanName: amc.amcPlanName || amc.planName,
        status: amc.status,
        paymentStatus: amc.paymentStatus,
        startDate: amc.startDate,
        endDate: amc.endDate,
        amcPlanPrice: amc.amcPlanPrice || amc.amount,
        servicesTotal: amc.servicesTotal,
        servicesUsed: amc.servicesUsed,
        serviceHistory: amc.serviceHistory || [],
        createdAt: amc.createdAt,
        source: amc.source
      }));

    res.json({
      customer: {
        _id: customer._id,
        userId: user?._id || customer.userId,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email || "N/A",
        address: customer.address
      },
      orders: formattedOrders,
      amcs: formattedAmcs
    });
  } catch (error) {
    console.error("getCustomerCompleteHistory error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all customers
export const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
          { "address.city": { $regex: search, $options: "i" } },
          { customerId: { $regex: search, $options: "i" } },
        ],
      };
    }
    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Complaints (Aggregated)
export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Customer.aggregate([
      { $unwind: "$complaints" },
      { $sort: { "complaints.date": -1 } },
      {
        $project: {
          _id: 0,
          customerId: "$_id",
          customerName: "$name",
          customerMobile: "$mobile",
          ticketId: { $ifNull: ["$complaints.complaintId", "$complaints._id"] },
          complaintId: { $ifNull: ["$complaints.complaintId", "$complaints._id"] },
          type: "$complaints.type",
          priority: "$complaints.priority",
          status: "$complaints.status",
          date: "$complaints.date",
          description: "$complaints.description",
          assignedTechnician: "$complaints.assignedTechnician",
          resolutionNotes: "$complaints.resolutionNotes"
        }
      }
    ]);
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single customer
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;

    // Try to find by ObjectId first
    try {
      customer = await Customer.findById(id);
    } catch (err) {
      // If not a valid ObjectId, try finding by phone number
      if (err.kind === 'ObjectId') {
        customer = await Customer.findOne({ mobile: id });
      }
    }

    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create customer
export const createCustomer = async (req, res) => {
  try {
    const newCustomer = new Customer(req.body);
    await newCustomer.save();
    res.status(201).json(newCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    let updatedCustomer = null;

    console.log('updateCustomer called with id:', id);
    console.log('Request body keys:', Object.keys(req.body));

    // Sanitize the data - remove undefined values
    const cleanData = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined && value !== null && value !== '') {
        cleanData[key] = value;
      }
    }

    // Try to find by ObjectId first
    try {
      updatedCustomer = await Customer.findByIdAndUpdate(
        id,
        cleanData,
        { new: true, runValidators: false }
      );
    } catch (err) {
      console.log('ObjectId lookup failed:', err.kind);
      // If not a valid ObjectId, try finding by phone number
      if (err.kind === 'ObjectId' || !updatedCustomer) {
        updatedCustomer = await Customer.findOneAndUpdate(
          { mobile: id },
          cleanData,
          { new: true, runValidators: false }
        );
      }
    }

    // If still not found, create new customer with phone as identifier
    if (!updatedCustomer) {
      const existingByPhone = await Customer.findOne({ mobile: id });
      if (existingByPhone) {
        updatedCustomer = existingByPhone;
      } else {
        updatedCustomer = await Customer.create({
          ...cleanData,
          mobile: id
        });
      }
    }

    console.log('Customer updated successfully');
    res.json(updatedCustomer);
  } catch (error) {
    console.error('updateCustomer error:', error.message);
    res.status(400).json({ message: error.message });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    let result = null;

    // Try to delete by ObjectId first
    try {
      result = await Customer.findByIdAndDelete(id);
    } catch (err) {
      // If not a valid ObjectId, try deleting by phone number
      if (err.kind === 'ObjectId') {
        result = await Customer.findOneAndDelete({ mobile: id });
      }
    }

    if (!result) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Service History
export const addService = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;

    // Try to find by ObjectId first
    try {
      customer = await Customer.findById(id);
    } catch (err) {
      // If not a valid ObjectId, try finding by phone number
      if (err.kind === 'ObjectId') {
        customer = await Customer.findOne({ mobile: id });
      }
    }

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.serviceHistory.push(req.body);
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Add Complaint
export const addComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    let customer = null;

    // Try to find by ObjectId first
    try {
      customer = await Customer.findById(id);
    } catch (err) {
      // If not a valid ObjectId, try finding by phone number
      if (err.kind === 'ObjectId') {
        customer = await Customer.findOne({ mobile: id });
      }
    }

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const allCustomers = await Customer.find({ "complaints.0": { $exists: true } });
    let maxNumber = 0;

    allCustomers.forEach(c => {
      c.complaints.forEach(comp => {
        if (comp.complaintId && comp.complaintId.startsWith('TKT-')) {
          const num = parseInt(comp.complaintId.split('-')[1]);
          if (!isNaN(num) && num > maxNumber) maxNumber = num;
        }
      });
    });

    const complaint = {
      ...req.body,
      complaintId: `TKT-${String(maxNumber + 1).padStart(5, '0')}`
    };
    customer.complaints.push(complaint);
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get AMC Dashboard Data (Stats + List)
export const getAMCDashboard = async (req, res) => {
  try {
    const { status, timeframe, area, search } = req.query;

    let query = { "amcDetails.planName": { $exists: true, $ne: "" } };

    if (status && status !== 'All') {
      const today = new Date();
      if (status === 'Active') query["amcDetails.status"] = 'Active';
      if (status === 'Expired') query["amcDetails.status"] = 'Expired';
      if (status === 'Expiring Soon') {
        const next30 = new Date();
        next30.setDate(today.getDate() + 30);
        query["amcDetails.endDate"] = { $gte: today, $lte: next30 };
        query["amcDetails.status"] = 'Active';
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { "amcDetails.planName": { $regex: search, $options: "i" } },
        { "amcDetails.amcId": { $regex: search, $options: "i" } }
      ];
    }

    if (area && area !== 'All') {
      query["address.area"] = area;
    }

    const customers = await Customer.find(query).sort({ "amcDetails.endDate": 1 });

    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const stats = {
      total: 0,
      active: 0,
      expired: 0,
      expiringSoon: 0,
      revenue: 0,
    };

    const allAmcCustomers = await Customer.find({ "amcDetails.planName": { $exists: true, $ne: "" } });

    const productMap = {};

    allAmcCustomers.forEach(c => {
      stats.total++;
      const end = new Date(c.amcDetails.endDate);
      const isActive = c.amcDetails.status === 'Active' && end >= today;

      if (isActive) {
        stats.active++;
        if (end <= next30Days) stats.expiringSoon++;
      } else {
        stats.expired++;
      }
      stats.revenue += c.amcDetails.amountPaid || 0;

      if (c.purifiers && c.purifiers.length > 0) {
        const product = c.purifiers[0];
        const productName = `${product.brand || 'Unknown'} ${product.model || ''}`;

        if (!productMap[productName]) {
          productMap[productName] = { productName, count: 0, active: 0, expiring: 0, expired: 0 };
        }

        productMap[productName].count++;
        if (isActive) {
          productMap[productName].active++;
          if (end <= next30Days) productMap[productName].expiring++;
        } else {
          productMap[productName].expired++;
        }
      }
    });

    const productStats = Object.values(productMap);

    res.json({ stats, customers, productStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create New AMC
export const createAMC = async (req, res) => {
  try {
    const { customerId, planName, planType, amcType, durationMonths, startDate, amount, notes, assignedTechnician, servicesTotal, partsIncluded } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(durationMonths));

    const newAMC = {
      amcId: `AMC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      planName,
      planType,
      amcType: amcType || "Paid",
      startDate: start,
      endDate: end,
      durationMonths,
      servicesTotal,
      servicesUsed: 0,
      partsIncluded: partsIncluded || false,
      amount: amount,
      amountPaid: 0,
      paymentStatus: "Pending",
      status: "Active",
      assignedTechnician,
      notes
    };

    if (customer.amcDetails && customer.amcDetails.planName) {
      customer.amcHistory.push(customer.amcDetails);
    }

    customer.amcDetails = newAMC;
    customer.type = "AMC Customer";

    await customer.save();

    try {
      await Transaction.create({
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: null,
        amount: amount,
        status: 'success',
        paymentMethod: 'Cash',
        paymentGateway: 'Manual',
        description: `AMC Plan: ${planName} - ${customer.name}`,
        type: 'amc',
        referenceId: newAMC.amcId
      });
    } catch (txnErr) {
      console.error('Failed to create AMC transaction:', txnErr);
    }

    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Renew AMC
export const renewAMC = async (req, res) => {
  try {
    const { id } = req.params;
    const { planName, planType, durationMonths, startDate, amount, paymentMode, paymentStatus, amountPaid } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    if (customer.amcDetails) {
      customer.amcDetails.status = "Expired";
      customer.amcHistory.push(customer.amcDetails);
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(durationMonths));

    const newAMC = {
      amcId: `AMC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      planName,
      planType,
      startDate: start,
      endDate: end,
      durationMonths,
      servicesTotal: req.body.servicesTotal || 3,
      servicesUsed: 0,
      partsIncluded: req.body.partsIncluded || false,
      amount,
      amountPaid: amountPaid || 0,
      paymentMode,
      paymentStatus: paymentStatus || "Pending",
      status: "Active",
      assignedTechnician: req.body.assignedTechnician || customer.amcDetails.assignedTechnician,
      notes: req.body.notes
    };

    customer.amcDetails = newAMC;
    await customer.save();

    try {
      await Transaction.create({
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: null,
        amount: amountPaid || amount,
        status: paymentStatus === 'paid' ? 'success' : 'pending',
        paymentMethod: paymentMode || 'Cash',
        paymentGateway: 'Manual',
        description: `AMC Renewal: ${planName} - ${customer.name}`,
        type: 'amc',
        referenceId: newAMC.amcId
      });
    } catch (txnErr) {
      console.error('Failed to create AMC renewal transaction:', txnErr);
    }

    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update Complaint Status
export const updateComplaintStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, resolutionNotes, assignedTechnician, priority } = req.body;

    if (!ticketId || ticketId === "undefined") {
      return res.status(400).json({ message: "Invalid Ticket ID" });
    }

    let query = { "complaints.complaintId": ticketId };
    let customer = await Customer.findOne(query);

    if (!customer) {
      query = { "complaints._id": ticketId };
      customer = await Customer.findOne(query);
    }

    if (!customer) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const updateFields = {};
    if (status) updateFields["complaints.$.status"] = status;
    if (resolutionNotes) updateFields["complaints.$.resolutionNotes"] = resolutionNotes;
    if (assignedTechnician) updateFields["complaints.$.assignedTechnician"] = assignedTechnician;
    if (priority) updateFields["complaints.$.priority"] = priority;

    const updatedCustomer = await Customer.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    );

    try {
      const updateObj = {};
      if (assignedTechnician) updateObj["serviceHistory.$.technicianName"] = assignedTechnician;
      if (resolutionNotes) updateObj["serviceHistory.$.notes"] = resolutionNotes;

      if (Object.keys(updateObj).length > 0) {
        await UserAmc.findOneAndUpdate(
          { "serviceHistory.complaintId": ticketId },
          { $set: updateObj }
        );
      }
    } catch (syncErr) {
      console.error("Failed to sync status to UserAmc:", syncErr);
    }

    try {
      const userRecord = await User.findOne({ $or: [{ phone: customer.mobile }, { email: customer.email }] });
      if (userRecord) {
        let title = "Update on your service request";
        let message = `Your request ${ticketId} status is now ${status || 'updated'}.`;

        if (assignedTechnician) {
          title = "Technician Assigned";
          message = `Technician ${assignedTechnician} has been assigned to your request ${ticketId}.`;
        } else if (status === "Resolved") {
          title = "Request Resolved";
          message = `Your service request ${ticketId} has been marked as resolved.`;
        }

        await UserNotification.create({
          userId: userRecord._id,
          title,
          message,
          type: "Service",
          refId: ticketId
        });
      }
    } catch (notifErr) {
      console.error("Failed to create user notification:", notifErr);
    }

    res.json({ message: "Complaint updated successfully", customer: updatedCustomer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Complaint
export const deleteComplaint = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId || ticketId === "undefined") {
      return res.status(400).json({ message: "Invalid Ticket ID" });
    }

    let query = { "complaints.complaintId": ticketId };
    let customer = await Customer.findOne(query);

    if (!customer) {
      query = { "complaints._id": ticketId };
      customer = await Customer.findOne(query);
    }

    if (!customer) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    customer.complaints = customer.complaints.filter(
      c => c._id.toString() !== ticketId && c.complaintId !== ticketId
    );

    await customer.save();

    res.json({ message: "Complaint deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

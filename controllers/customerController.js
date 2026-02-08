import Customer from "../models/Customer.js";

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
          ticketId: "$complaints.complaintId",
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
    const customer = await Customer.findById(req.params.id);
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
    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedCustomer)
      return res.status(404).json({ message: "Customer not found" });
    res.json(updatedCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Service History
export const addService = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    
    customer.serviceHistory.push(req.body);
    
    // Update next due date logic or other fields if needed
    // For now assuming req.body contains the service object
    
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Add Complaint
export const addComplaint = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const complaint = {
        ...req.body,
        complaintId: `TKT-${Date.now()}`
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
    
    // Status Filter
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

    // Search Filter
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

    // Calculate Stats
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

    // Recalculate stats from ALL AMC customers (ignoring filters for the tiles, generally preferred)
    // To do that efficiently, maybe separate query. For now, let's calculate based on matching if that's what user wants, 
    // OR fetch all stats separately. Let's do a separate count aggregation for accuracy.
    
    const allAmcCustomers = await Customer.find({ "amcDetails.planName": { $exists: true, $ne: "" } });
    
    allAmcCustomers.forEach(c => {
        stats.total++;
        const end = new Date(c.amcDetails.endDate);
        const isActive = c.amcDetails.status === 'Active' && end >= today;
        
        if (isActive) {
            stats.active++;
            if (end <= next30Days) stats.expiringSoon++;
        } else {
            stats.expired++; // Or relying on status
        }
        stats.revenue += c.amcDetails.amountPaid || 0;
    });

    res.json({ stats, customers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create New AMC
export const createAMC = async (req, res) => {
    try {
        const { customerId, planName, planType, durationMonths, startDate, amount, notes, assignedTechnician, servicesTotal, partsIncluded } = req.body;
        
        const customer = await Customer.findById(customerId);
        if(!customer) return res.status(404).json({ message: "Customer not found" });

        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + parseInt(durationMonths));

        const newAMC = {
            amcId: `AMC-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            planName,
            planType,
            startDate: start,
            endDate: end,
            durationMonths,
            servicesTotal,
            servicesUsed: 0,
            partsIncluded: partsIncluded || false,
            amount: amount,
            amountPaid: 0, 
            paymentStatus: "Pending",
            status: "Active", // Default to active, or pending payment
            assignedTechnician,
            notes
        };

        // If existing AMC exists, archive it?
        if (customer.amcDetails && customer.amcDetails.planName) {
            customer.amcHistory.push(customer.amcDetails);
        }

        customer.amcDetails = newAMC;
        customer.type = "AMC Customer";
        
        await customer.save();
        res.status(201).json(customer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Renew AMC
export const renewAMC = async (req, res) => {
    try {
        const { id } = req.params; // Customer ID
        const { planName, planType, durationMonths, startDate, amount, paymentMode, paymentStatus, amountPaid } = req.body;

        const customer = await Customer.findById(id);
        if(!customer) return res.status(404).json({ message: "Customer not found" });

        // Archive current
        if (customer.amcDetails) {
            customer.amcDetails.status = "Expired"; // Mark old as expired
            customer.amcHistory.push(customer.amcDetails);
        }

        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + parseInt(durationMonths));

        const newAMC = {
            amcId: `AMC-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            planName,
            planType,
            startDate: start,
            endDate: end,
            durationMonths,
            servicesTotal: req.body.servicesTotal || 3, // Default or from body
            servicesUsed: 0,
            partsIncluded: req.body.partsIncluded || false,
            amount,
            amountPaid: amountPaid || 0,
            paymentMode,
            paymentStatus: paymentStatus || "Pending",
            status: "Active",
            assignedTechnician: req.body.assignedTechnician || customer.amcDetails.assignedTechnician, // Keep prev tech if not changed
            notes: req.body.notes
        };

        customer.amcDetails = newAMC;
        await customer.save();
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

    // Use positional operator $ to update the specific element in array
    const query = { "complaints.complaintId": ticketId };
    const updateFields = {};

    if (status) updateFields["complaints.$.status"] = status;
    if (resolutionNotes) updateFields["complaints.$.resolutionNotes"] = resolutionNotes;
    if (assignedTechnician) updateFields["complaints.$.assignedTechnician"] = assignedTechnician;
    if (priority) updateFields["complaints.$.priority"] = priority;

    const customer = await Customer.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    res.json({ message: "Complaint updated successfully", customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

import Customer from "../models/Customer.js";
import User from "../models/User.js";

// Helper to find linked customer
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  // Try to find customer by phone first (more unique identifier usually)
  let customer = await Customer.findOne({ mobile: user.phone });
  
  // If not found, try email
  if (!customer && user.email) {
    customer = await Customer.findOne({ email: user.email });
  }

  return { user, customer };
};

export const getMyAMC = async (req, res) => {
  try {
    const linkedData = await findLinkedCustomer(req.user.sub);
    if (!linkedData) {
        return res.status(404).json({ message: "User account not found" });
    }
    const { customer } = linkedData;

    if (!customer) {
      // Return empty state if no customer record exists yet
      return res.status(200).json({ 
        success: true, 
        amc: [], 
        history: [],
        serviceHistory: [] 
      });
    }

    // Transform customer data to match frontend expectations
    const amcList = [];
    if (customer.amcDetails && customer.amcDetails.status === 'Active') {
      amcList.push({
        _id: customer.amcDetails.amcId || customer.amcDetails._id,
        serviceType: 'Annual Maintenance Contract',
        productName: customer.purifiers && customer.purifiers.length > 0 
          ? `${customer.purifiers[0].brand} ${customer.purifiers[0].model}` 
          : 'Water Purifier',
        planName: customer.amcDetails.planName || 'Standard Plan',
        status: customer.amcDetails.status,
        startDate: customer.amcDetails.startDate,
        expiryDate: customer.amcDetails.endDate,
        lastService: customer.serviceHistory && customer.serviceHistory.length > 0
          ? customer.serviceHistory[customer.serviceHistory.length - 1].date
          : 'Not yet serviced',
        price: customer.amcDetails.amount
      });
    }

    res.status(200).json({
      success: true,
      amc: amcList,
      serviceHistory: customer.serviceHistory || [],
      // You can add more data if needed
    });
  } catch (error) {
    console.error("getMyAMC Error:", error);
    res.status(500).json({ message: "Server error fetching AMC details" });
  }
};

export const purchaseAMC = async (req, res) => {
  try {
    const { planName, price, duration, features } = req.body;
    const linkedData = await findLinkedCustomer(req.user.sub);
    if (!linkedData) {
        return res.status(404).json({ message: "User account not found" });
    }
    const { user, customer } = linkedData;

    let targetCustomer = customer;

    // If no customer record, create one based on User data
    if (!targetCustomer) {
      targetCustomer = new Customer({
        name: `${user.firstName} ${user.lastName}`,
        mobile: user.phone,
        email: user.email,
        type: "AMC Customer",
        status: "Active"
      });
    }

    // Set AMC Details
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // Default 1 year

    targetCustomer.amcDetails = {
      planName,
      amount: price,
      amountPaid: price,
      paymentStatus: "Paid",
      startDate: startDate,
      endDate: endDate,
      status: "Active",
      planType: "Custom", // Simplified
      servicesTotal: 3 // Default
    };

    targetCustomer.amcHistory.push(targetCustomer.amcDetails);

    await targetCustomer.save();

    res.status(200).json({ success: true, message: "AMC Plan activated successfully" });
  } catch (error) {
    console.error("purchaseAMC Error:", error);
    res.status(500).json({ message: "Server error activating plan" });
  }
};

export const renewAMC = async (req, res) => {
  try {
    const { amcId } = req.body; // In this simplifed version, we just assume renewing the current active one
    const linkedData = await findLinkedCustomer(req.user.sub);
    if (!linkedData) {
        return res.status(404).json({ message: "User account not found" });
    }
    const { customer } = linkedData;

    if (!customer || !customer.amcDetails) {
      return res.status(404).json({ message: "No active AMC found to renew" });
    }

    // Extend validity by 1 year
    const currentEndDate = new Date(customer.amcDetails.endDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    customer.amcDetails.endDate = newEndDate;
    customer.amcHistory.push({ ...customer.amcDetails, status: "Renewed" }); // Archive old state? Or just log renewal
    
    await customer.save();

    res.status(200).json({ success: true, message: "AMC Renewed successfully", newExpiry: newEndDate });
  } catch (error) {
    console.error("renewAMC Error:", error);
    res.status(500).json({ message: "Server error renewing plan" });
  }
};

export const createServiceRequest = async (req, res) => {
  try {
    const { type, date, notes } = req.body;
    const linkedData = await findLinkedCustomer(req.user.sub);
    if (!linkedData) {
        return res.status(404).json({ message: "User account not found" });
    }
    const { user, customer } = linkedData;

    let targetCustomer = customer;
     if (!targetCustomer) {
      // Use case: User requests service but isn't a customer yet? 
      // Theoretically possible if they just signed up. We should create a prospect customer.
      targetCustomer = new Customer({
        name: `${user.firstName} ${user.lastName}`,
        mobile: user.phone,
        email: user.email,
        type: "New",
      });
    }

    targetCustomer.complaints.push({
      type: type || "Other",
      description: notes,
      priority: "Medium",
      status: "Open",
      date: date ? new Date(date) : new Date()
    });

    await targetCustomer.save();

    res.status(200).json({ success: true, message: "Service request logged successfully" });

  } catch (error) {
    console.error("createServiceRequest Error:", error);
    res.status(500).json({ message: "Server error creating service request" });
  }
};

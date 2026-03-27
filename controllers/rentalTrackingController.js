import Customer from "../models/Customer.js";

export const getRentalTracking = async (req, res) => {
  try {
    const { status, payment, search } = req.query;

    const query = { "rentalDetails.planName": { $exists: true, $ne: "" } };

    if (status && status !== "All") query["rentalDetails.status"] = status;
    if (payment && payment !== "All") query["rentalDetails.paymentStatus"] = payment;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { "rentalDetails.planName": { $regex: search, $options: "i" } },
        { "rentalDetails.machineModel": { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query)
      .populate("rentalDetails.planId")
      .sort({ "rentalDetails.nextDueDate": 1 })
      .lean();

    const today = new Date();
    const next7 = new Date(today); next7.setDate(today.getDate() + 7);
    const next30 = new Date(today); next30.setDate(today.getDate() + 30);

    const stats = { total: 0, active: 0, pending: 0, overdue: 0, cancelled: 0, dueSoon: 0, totalRevenue: 0 };

    const all = await Customer.find({ "rentalDetails.planName": { $exists: true, $ne: "" } }).lean();
    all.forEach(c => {
      const r = c.rentalDetails;
      stats.total++;
      if (r.status === "Active") stats.active++;
      else if (r.status === "Pending") stats.pending++;
      else if (r.status === "Cancelled") stats.cancelled++;
      if (r.paymentStatus === "Overdue") stats.overdue++;
      if (r.nextDueDate && new Date(r.nextDueDate) <= next7 && r.status === "Active") stats.dueSoon++;
      stats.totalRevenue += r.amount || 0;
    });

    res.json({ stats, customers });
  } catch (err) {
    console.error("getRentalTracking error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateRentalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, nextDueDate, notes } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    if (status) customer.rentalDetails.status = status;
    if (paymentStatus) customer.rentalDetails.paymentStatus = paymentStatus;
    if (nextDueDate) customer.rentalDetails.nextDueDate = new Date(nextDueDate);
    if (notes !== undefined) customer.rentalDetails.notes = notes;

    await customer.save();
    res.json({ message: "Rental updated", rentalDetails: customer.rentalDetails });
  } catch (err) {
    console.error("updateRentalStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

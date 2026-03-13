import UserAmc from "../models/UserAmc.js";
import User from "../models/User.js";

// Get upcoming service jobs (due within 7 days)
export const getUpcomingServiceJobs = async (req, res) => {
  try {
    const jobs = await UserAmc.getUpcomingServiceJobs()
      .select('_id userId amcId productName nextServiceDueDate serviceSchedule servicesUsed servicesTotal status');
    
    res.json({
      count: jobs.length,
      jobs: jobs.map(job => ({
        _id: job._id,
        amcId: job.amcId,
        productName: job.productName,
        nextServiceDueDate: job.nextServiceDueDate,
        daysUntilService: job.daysUntilNextService,
        serviceType: job.serviceSchedule?.serviceType || 'Regular Service',
        serviceDescription: job.serviceSchedule?.description,
        servicesUsed: job.servicesUsed,
        servicesTotal: job.servicesTotal,
        customer: job.userId ? {
          _id: job.userId._id,
          name: `${job.userId.firstName} ${job.userId.lastName}`,
          email: job.userId.email,
          phone: job.userId.phone,
          address: job.userId.addresses?.[0] || {}
        } : null
      }))
    });
  } catch (err) {
    console.error("getUpcomingServiceJobs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all AMC statistics
export const getAmcStatistics = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      totalActive: await UserAmc.countDocuments({ status: 'Active' }),
      totalExpired: await UserAmc.countDocuments({ status: 'Expired' }),
      upcomingServices: await UserAmc.countDocuments({
        status: 'Active',
        nextServiceDueDate: { $lte: sevenDaysLater, $gte: now }
      }),
      overdueServices: await UserAmc.countDocuments({
        status: 'Active',
        nextServiceDueDate: { $lt: now }
      })
    };
    
    res.json(stats);
  } catch (err) {
    console.error("getAmcStatistics error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all AMCs with filters
export const getAllAmcs = async (req, res) => {
  try {
    const { status, filter } = req.query;
    let query = {};
    
    if (status) query.status = status;
    
    if (filter === 'upcoming') {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.status = 'Active';
      query.nextServiceDueDate = { $lte: sevenDaysLater, $gte: now };
    } else if (filter === 'overdue') {
      query.status = 'Active';
      query.nextServiceDueDate = { $lt: new Date() };
    }
    
    const amcs = await UserAmc.find(query)
      .populate('userId', 'firstName lastName email phone addresses city state')
      .populate('amcPlanId', 'name durationMonths serviceSchedule')
      .populate('productId', 'name')
      .sort({ nextServiceDueDate: 1 })
      .limit(500)
      .lean();
    
    res.json({
      count: amcs.length,
      amcs: amcs.map(amc => ({
        _id: amc._id,
        amcId: amc.amcId,
        productName: amc.productName,
        productImage: amc.productImage,
        amcPlanName: amc.amcPlanName,
        durationMonths: amc.durationMonths,
        startDate: amc.startDate,
        endDate: amc.endDate,
        nextServiceDueDate: amc.nextServiceDueDate,
        daysUntilService: amc.nextServiceDueDate ? 
          Math.ceil((new Date(amc.nextServiceDueDate) - now) / (1000 * 60 * 60 * 24)) : null,
        serviceType: amc.serviceSchedule?.serviceType,
        servicesUsed: amc.servicesUsed,
        servicesTotal: amc.servicesTotal,
        status: amc.status,
        customer: amc.userId ? {
          _id: amc.userId._id,
          name: `${amc.userId.firstName} ${amc.userId.lastName}`,
          email: amc.userId.email,
          phone: amc.userId.phone,
          city: amc.userId.city,
          state: amc.userId.state,
          address: amc.userId.addresses?.[0]
        } : null
      }))
    });
  } catch (err) {
    console.error("getAllAmcs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update next service due date for an AMC
export const updateNextServiceDueDate = async (req, res) => {
  try {
    const { amcId } = req.params;
    const { nextServiceDueDate } = req.body;
    
    const amc = await UserAmc.findByIdAndUpdate(
      amcId,
      { nextServiceDueDate: new Date(nextServiceDueDate) },
      { new: true }
    );
    
    if (!amc) {
      return res.status(404).json({ message: "AMC not found" });
    }
    
    res.json({ message: "Next service due date updated", amc });
  } catch (err) {
    console.error("updateNextServiceDueDate error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

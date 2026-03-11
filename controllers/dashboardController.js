// controllers/dashboardController.js
import moment from "moment-timezone";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Offer from "../models/Offer.js";
import Enquiry from "../models/Enquiry.js";
import Employee from "../models/Employee.js";
import UserAmc from "../models/UserAmc.js";
import AssignedTicket from "../models/AssignedTicket.js";

export const getDashboardStats = async (req, res) => {
  try {
    // Use IST for time-based analytics
    const now = moment().tz("Asia/Kolkata");
    const startOfToday = now.clone().startOf("day").toDate();
    const startOfMonth = now.clone().startOf("month").toDate();
    const last7Days = now.clone().subtract(6, "days").startOf("day").toDate();

    // ---------- BASIC COUNTS ----------
    const [
      totalOrders,
      totalProducts,
      activeProducts,
      totalCategories,
      activeCategories,
      totalEnquiries,
      unreadEnquiries,
      activeOffersCount,
      allRevenueAgg,
      todayOrdersCount,
      monthRevenueAgg,
      statusAgg,
      paymentMethodAgg,
      paymentStatusAgg,
      salesLast7DaysAgg,
      productsByCategoryAgg,
      latestOrders,
      latestProducts,
      recentEnquiries,
      activeOffersList,
      allUserAmcsForDue,
      openAmcTicketsForDue,
    ] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ isRead: false }),
      Offer.countDocuments({ isActive: true }),

      // Total revenue
      Order.aggregate([
        { $group: { _id: null, revenue: { $sum: "$total" } } },
      ]),

      // Today's orders
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),

      // This month's revenue
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: "$total" } } },
      ]),

      // Orders by status
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Orders by payment method (COD, ONLINE, etc.)
      Order.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
      ]),

      // Orders by payment status (pending, paid, failed)
      Order.aggregate([
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
      ]),

      // Sales in last 7 days (graph data)
      Order.aggregate([
        { $match: { createdAt: { $gte: last7Days } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Kolkata",
              },
            },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Products by category (for pie chart)
      Product.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $group: {
            _id: "$category._id",
            name: { $first: "$category.name" },
            slug: { $first: "$category.slug" },
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: {
                $cond: [{ $eq: ["$isActive", true] }, 1, 0],
              },
            },
          },
        },
        { $sort: { totalProducts: -1 } },
      ]),

      // Latest 10 orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("items.product", "name slug"),

      // Latest 10 products
      Product.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("category", "name slug"),

      // Latest 5 enquiries
      Enquiry.find()
        .sort({ createdAt: -1 })
        .limit(5),

      // List of active offers
      Offer.find({ isActive: true }).sort({ createdAt: -1 }).limit(10),

      // AMC stats
      UserAmc.find().select('status startDate endDate servicesUsed servicesTotal'),
      AssignedTicket.find({ amcId: { $exists: true }, status: { $in: ['Pending', 'In Progress'] } }).select('amcId'),
    ]);

    const allAmcs = allUserAmcsForDue || [];
    const openAmcIds = (openAmcTicketsForDue || []).map(t => t.amcId.toString());
    const intervalMonths = 4;
    const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
    const nowTime = new Date().getTime();

    let activeAmcCount = 0;
    let expiredAmcCount = 0;
    const totalAmcCount = allAmcs.length;

    const dueAmcCount = allAmcs.filter(amc => {
      const isDateExpired = new Date(amc.endDate).getTime() < nowTime;
      const isServicesExhausted = (amc.servicesUsed || 0) >= (amc.servicesTotal || 4);

      if (amc.status === 'Active' && !isDateExpired && !isServicesExhausted) {
        activeAmcCount++;
      } else if (amc.status === 'Expired' || isDateExpired || isServicesExhausted) {
        expiredAmcCount++;
      }

      // Only active and non-expired AMCs can be "Due"
      if (amc.status !== 'Active' || isDateExpired || isServicesExhausted) return false;
      if (openAmcIds.includes(amc._id.toString())) return false;

      const startDate = new Date(amc.startDate);
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + ((amc.servicesUsed + 1) * intervalMonths));
      return dueDate <= new Date(nowTime + fifteenDaysInMs);
    }).length;

    let totalEmployees = 0;
    let activeEmployees = 0;
    try {
      totalEmployees = await Employee.countDocuments();
      activeEmployees = await Employee.countDocuments({ status: true });
    } catch (empErr) {
      console.error("Failed to fetch employee stats:", empErr);
    }

    const totalRevenue = allRevenueAgg[0]?.revenue || 0;
    const monthRevenue = monthRevenueAgg[0]?.revenue || 0;
    const avgOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const transformAgg = (agg) =>
      agg.map((item) => ({
        label: item._id || "Unknown",
        count: item.count,
      }));

    const ordersByStatus = transformAgg(statusAgg);
    const ordersByPaymentMethod = transformAgg(paymentMethodAgg);
    const ordersByPaymentStatus = transformAgg(paymentStatusAgg);

    const salesLast7Days = salesLast7DaysAgg.map((d) => ({
      date: d._id,
      revenue: d.revenue,
      orders: d.orders,
    }));

    const productsByCategory = productsByCategoryAgg.map((c) => ({
      categoryId: c._id,
      name: c.name,
      slug: c.slug,
      totalProducts: c.totalProducts,
      activeProducts: c.activeProducts,
    }));

    // FINAL RESPONSE STRUCTURE – perfect for frontend cards, charts & tables 👌
    res.json({
      summaryCards: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        monthRevenue,
        totalProducts,
        activeProducts,
        totalCategories,
        activeCategories,
        totalEnquiries,
        unreadEnquiries,
        activeOffers: activeOffersCount,
        todayOrders: todayOrdersCount,
        totalEmployees,
        activeEmployees,
        dueAmcCount,
        totalAmcCount,
        activeAmcCount,
        expiredAmcCount,
      },
      charts: {
        salesLast7Days, // line/bar chart
        ordersByStatus, // donut/pie
        ordersByPaymentMethod,
        ordersByPaymentStatus,
        productsByCategory, // pie chart
      },
      tables: {
        latestOrders,
        latestProducts,
        recentEnquiries,
        activeOffers: activeOffersList,
      },
      meta: {
        generatedAtIST: now.format("DD-MM-YYYY hh:mm:ss A"),
      },
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

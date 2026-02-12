
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import UserAmc from "../models/UserAmc.js";
import moment from "moment-timezone";

// Helper to find linked customer (Robust logic matching Dashboard)
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { user: null, customer: null };

  const query = [];
  
  // 1. Match by Phone (Fuzzy match for last 10 digits)
  if (user.phone) {
    const normalizedPhone = user.phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length === 10) {
      // Create a fuzzy regex: e.g. "1234567890" -> /1[^0-9]*2[^0-9]*3...0$/
      const fuzzyPattern = normalizedPhone.split("").join("[^0-9]*") + "$";
      query.push({ mobile: { $regex: fuzzyPattern } });
    } else {
      query.push({ mobile: new RegExp(user.phone.replace(/\D/g, "") + "$") });
    }
  }

  // 2. Match by Email
  if (user.email) {
    query.push({ email: { $regex: `^${user.email}$`, $options: 'i' } });
  }

  if (query.length === 0) return { user, customer: null };

  const customer = await Customer.findOne({ $or: query });
  return { user, customer };
};

export const getUserRentalDetails = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { customer } = await findLinkedCustomer(userId);

    // 1. Check for web-purchased Rental in UserAmc first (Priority)
    const webRental = await UserAmc.findOne({ 
        userId, 
        status: 'Active',
        productType: 'RentalPlan'
    }).sort({ endDate: -1 });

    if (webRental) {
      return res.json({ 
        rental: {
          planName: webRental.productName,
          status: webRental.status,
          startDate: webRental.startDate,
          endDate: webRental.endDate,
          nextDueDate: webRental.endDate, // Use end date as next due for web items
          amount: webRental.amcPlanPrice,
          machineModel: webRental.productName,
          machineImage: webRental.productImage
        },
        amc: null
      });
    }

    // 2. Admin-managed Customer record
    if (customer) {
        // Option A: Explicit Rental Details
        if (customer.rentalDetails && customer.rentalDetails.status !== "Inactive") {
            return res.json({ 
               rental: customer.rentalDetails,
               amc: customer.amcDetails 
            });
        }

        // Option B: Fallback - If customer is Active and has purifiers (Handles cases where admin only fills purifier list)
        if (customer.status === "Active" && customer.purifiers && customer.purifiers.length > 0) {
            const firstUnit = customer.purifiers[0];
            return res.json({
                rental: {
                    planName: "Active Rental Subscription",
                    machineModel: `${firstUnit.brand} ${firstUnit.model}`.trim() || "RO System",
                    status: "Active",
                    startDate: firstUnit.installationDate || customer.createdAt,
                    amount: customer.rentalDetails?.amount || 0,
                    paymentStatus: "Paid",
                    machineImage: "" // Placeholder
                },
                amc: customer.amcDetails
            });
        }
    }

    res.json({ rental: null });
  } catch (err) {
    console.error("getUserRentalDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

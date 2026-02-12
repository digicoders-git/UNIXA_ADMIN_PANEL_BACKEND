
import Customer from "../models/Customer.js";
import User from "../models/User.js";
import UserAmc from "../models/UserAmc.js";
import RentalPlan from "../models/RentalPlan.js";
import Product from "../models/Product.js";
import moment from "moment-timezone";

// Helper to find linked customer (Robust logic matching Dashboard)
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { user: null, customer: null };

  const query = [];
  
  // 1. Match by Phone (Cleaned last 10 digits)
  if (user.phone) {
    const cleanUserPhone = user.phone.replace(/\D/g, "").slice(-10);
    if (cleanUserPhone.length === 10) {
      const fuzzyPattern = cleanUserPhone.split("").join("[^0-9]*") + "$";
      query.push({ mobile: { $regex: fuzzyPattern } });
    }
  }

  // 2. Match by Email
  if (user.email) {
    query.push({ email: { $regex: `^${user.email}$`, $options: 'i' } });
  }

  if (query.length === 0) return { user, customer: null };

  const customer = await Customer.findOne({ $or: query })
    .sort({ updatedAt: -1 })
    .populate('rentalDetails.planId');
    
  return { user, customer };
};

export const getUserRentalDetails = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { customer } = await findLinkedCustomer(userId);

    // 1. Priority: Web-purchased items in UserAmc
    const webRental = await UserAmc.findOne({ 
        userId, 
        status: { $in: ['Active', 'Pending'] },
        productType: 'RentalPlan'
    }).sort({ createdAt: -1 });

    if (webRental) {
      return res.json({ 
        rental: {
          planName: webRental.productName,
          status: webRental.status,
          startDate: webRental.startDate,
          endDate: webRental.endDate,
          nextDueDate: webRental.endDate || moment(webRental.startDate).add(1, 'month').toDate(),
          amount: webRental.amcPlanPrice,
          machineModel: webRental.productName,
          machineImage: webRental.productImage
        },
        amc: null
      });
    }

    // 2. Admin/Inquiry-managed Customer record
    if (customer) {
        let rentalData = null;

        // Extremely Loose Check: Show if there's ANY rental data or if the customer is not Cancelled
        const hasRentalDetails = customer.rentalDetails && customer.rentalDetails.status !== "Cancelled";
        const isNotCancelled = customer.status !== "Cancelled";

        if (hasRentalDetails && (customer.rentalDetails.planName || customer.rentalDetails.machineModel || customer.rentalDetails.status !== "Inactive")) {
            rentalData = { ...customer.rentalDetails.toObject() };
        } else if (isNotCancelled) {
            // Fallback for customers who might just be marked Active/Existing/Pending without full rental fields
            const unit = (customer.purifiers && customer.purifiers.length > 0) ? customer.purifiers[0] : null;
            rentalData = {
                planName: customer.rentalDetails?.planName || "Active Rental",
                machineModel: unit ? `${unit.brand} ${unit.model}` : (customer.rentalDetails?.machineModel || "Water Purifier"),
                status: customer.rentalDetails?.status || customer.status || "Active",
                startDate: unit?.installationDate || customer.createdAt,
                amount: customer.rentalDetails?.amount || 0,
                paymentStatus: "Payment Pending",
                machineImage: ""
            };
        }

        if (rentalData) {
            // ENRICHMENT
            const modelSearch = rentalData.machineModel || "";
            const planSearch = rentalData.planName || "";

            const linkedPlan = customer.rentalDetails?.planId || await RentalPlan.findOne({ 
                $or: [
                    { planName: new RegExp(planSearch, 'i') },
                    { planName: new RegExp(modelSearch, 'i') },
                    { planName: { $regex: modelSearch.split(' ').pop() || 'RO', $options: 'i' } }
                ]
            });

            const productData = (!rentalData.machineImage) ? await Product.findOne({
                $or: [
                    { name: new RegExp(modelSearch, 'i') },
                    { name: { $regex: modelSearch.split(' ').pop() || 'RO', $options: 'i' } }
                ]
            }) : null;

            rentalData.amount = rentalData.amount || linkedPlan?.price || 399;
            rentalData.machineImage = rentalData.machineImage || linkedPlan?.image?.url || productData?.mainImage?.url || "";
            if (rentalData.planName.includes("Request") && linkedPlan) rentalData.planName = linkedPlan.planName;

            // Dates
            rentalData.startDate = rentalData.startDate || customer.createdAt;
            if (!rentalData.nextDueDate) {
                rentalData.nextDueDate = moment(rentalData.startDate).add(1, 'month').toDate();
            }

            return res.json({ 
                rental: rentalData,
                amc: customer.amcDetails,
                user: {
                    name: customer.name,
                    mobile: customer.mobile,
                    email: customer.email
                }
            });
        }
    }

    res.json({ rental: null });
  } catch (err) {
    console.error("getUserRentalDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

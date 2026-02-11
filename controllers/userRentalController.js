
import Customer from "../models/Customer.js";
import User from "../models/User.js";

// Helper to find linked customer
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.phone) return null;
  // Normalize phone (last 10 digits) for robust matching
  const normalizedPhone = user.phone.replace(/\D/g, "").slice(-10);
  return await Customer.findOne({ mobile: new RegExp(normalizedPhone + "$") });
};

export const getUserRentalDetails = async (req, res) => {
  try {
    const customer = await findLinkedCustomer(req.user.sub);

    if (!customer || !customer.rentalDetails || customer.rentalDetails.status === "Inactive") {
      return res.json({ rental: null });
    }

    res.json({ 
      rental: customer.rentalDetails,
      amc: customer.amcDetails 
    });
  } catch (err) {
    console.error("getUserRentalDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

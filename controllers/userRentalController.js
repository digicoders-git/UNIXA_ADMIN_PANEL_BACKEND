
import Customer from "../models/Customer.js";
import User from "../models/User.js";

// Helper to find linked customer
const findLinkedCustomer = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;
  // Link by mobile number
  return await Customer.findOne({ mobile: user.phone });
};

export const getUserRentalDetails = async (req, res) => {
  try {
    const customer = await findLinkedCustomer(req.user.sub);

    if (!customer || !customer.rentalDetails || customer.rentalDetails.status === "Inactive") {
      return res.json({ rental: null });
    }

    res.json({ rental: customer.rentalDetails });
  } catch (err) {
    console.error("getUserRentalDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

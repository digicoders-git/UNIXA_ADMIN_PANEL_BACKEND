import Enquiry from "../models/Enquiry.js";
import AdminNotification from "../models/AdminNotification.js";
import Customer from "../models/Customer.js";
import RentalPlan from "../models/RentalPlan.js";
import Product from "../models/Product.js";

export const createEnquiry = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: "name and message required" });
    }
    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message,
    });

    // Create Admin Notification
    try {
      await AdminNotification.create({
        title: "New Website Enquiry",
        message: `${name} has sent a new enquiry regarding "${subject || 'General'}"`,
        type: "Enquiry",
        refId: enquiry._id
      });
    } catch (notifErr) {
      console.error("Failed to create admin notification:", notifErr);
    }

    // Logic to show in User Panel: Create/Update Customer with Pending Rental
    if (subject && subject.includes("Booking:") && phone) {
        try {
            const { planId, amount } = req.body;
            // Normalize for matching
            const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
            let customer = await Customer.findOne({ mobile: new RegExp(normalizedPhone + "$") });
            
            // If planId is provided, get model name for a better display
            let machineModel = "";
            let machineImage = "";
            if (planId) {
                const plan = await RentalPlan.findById(planId).populate('productId');
                if (plan) {
                    machineModel = plan.productId?.name || plan.planName;
                    machineImage = plan.image?.url || plan.productId?.mainImage?.url;
                }
            }

            const rentalData = {
                planId: planId || null,
                planName: subject.replace("Booking: ", ""),
                amount: amount || 0,
                status: "Pending",
                machineModel: machineModel,
                machineImage: machineImage,
                startDate: new Date()
            };

            if (customer) {
                // If they already have an active rental, don't overwrite? 
                // Usually we can just update to Pending for a new request
                customer.rentalDetails = rentalData;
                await customer.save();
            } else {
                await Customer.create({
                    name,
                    mobile: phone,
                    email: email || "",
                    type: "New",
                    rentalDetails: rentalData
                });
            }
        } catch (custErr) {
            console.error("Failed to link rental enquiry to customer:", custErr);
        }
    }

    res.status(201).json({ message: "Enquiry submitted", enquiry });
  } catch (err) {
    console.error("createEnquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listEnquiries = async (_req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json({ enquiries });
  } catch (err) {
    console.error("listEnquiries error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ message: "Not found" });
    res.json({ enquiry });
  } catch (err) {
    console.error("getEnquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isRead } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ message: "Not found" });

    if (status) enquiry.status = status;
    if (isRead !== undefined) enquiry.isRead = !!isRead;

    await enquiry.save();
    res.json({ message: "Enquiry updated", enquiry });
  } catch (err) {
    console.error("updateEnquiryStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

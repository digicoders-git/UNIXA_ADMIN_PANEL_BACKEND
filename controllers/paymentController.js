// controllers/paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import RentalPlan from "../models/RentalPlan.js";
import Enquiry from "../models/Enquiry.js";
import AdminNotification from "../models/AdminNotification.js";


// Initialize Razorpay lazily or handle missing keys gracefully
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay keys are missing in .env. Payment features will not work.");
}

// Create Razorpay Order
export const createPaymentOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;
    
    if (!razorpay) {
      return res.status(503).json({ message: "Payment service is currently unavailable (Keys missing)" });
    }

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("createPaymentOrder error:", err);
    res.status(500).json({ message: "Payment order creation failed" });
  }
};

// Verify Payment and Create Order
export const verifyPaymentAndCreateOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      shippingAddress,
      notes = "",
      offerCode = "",
    } = req.body;

    if (!razorpay) {
      return res.status(503).json({ message: "Payment service is currently unavailable (Keys missing)" });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment verification failed" 
      });
    }

    // Get user cart
    const cart = await Cart.findOne({ user: req.user.sub }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = cart.items.map(item => {
      const itemTotal = (item.product.finalPrice + item.addOnPrice) * item.quantity;
      subtotal += itemTotal;
      return {
        product: item.product._id,
        productName: item.product.name,
        productPrice: item.product.finalPrice,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        addOnName: item.addOnName,
      };
    });

    // Create order
    const order = await Order.create({
      userId: req.user.sub,
      items: orderItems,
      subtotal,
      total: subtotal,
      offerCode,
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "Online",
      shippingAddress,
      notes,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    // Clear cart
    await Cart.findOneAndUpdate(
      { user: req.user.sub },
      { items: [], totalItems: 0, totalAmount: 0 }
    );

    res.json({
      success: true,
      message: "Payment successful and order created",
      order,
    });
  } catch (err) {
    console.error("verifyPaymentAndCreateOrder error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Payment verification failed" 
    });
  }
};

// Handle Payment Failure
export const handlePaymentFailure = async (req, res) => {
  try {
    const { razorpay_order_id, error } = req.body;

    res.json({
      success: false,
      message: "Payment failed. Please try again.",
      error: error?.description || "Payment was not completed",
    });
  } catch (err) {
    console.error("handlePaymentFailure error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error handling payment failure" 
    });
  }
};

// Verify Rental Payment
export const verifyRentalPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      phone,
      email,
      address,
      message,
      planId,
      amount
    } = req.body;

    if (!razorpay) {
       return res.status(503).json({ message: "Payment service unavailable" });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // 1. Create Enquiry with Payment Details
    const subject = "Rental Booking (PAID)";
    const paymentInfo = `Payment ID: ${razorpay_payment_id}, Order ID: ${razorpay_order_id}`;
    const fullMessage = `${message}\n\n[ONLINE PAYMENT SUCCESSFUL]\n${paymentInfo}\nAmount: ₹${amount}`;

    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message: fullMessage,
      status: "new"
    });

    // 2. Link to Customer (Rental Logic)
    if (phone) {
        const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
        let customer = await Customer.findOne({ mobile: new RegExp(normalizedPhone + "$") });
        
        // Find Plan details for creating rental record
        let machineModel = "Unknown";
        let machineImage = "";
        
        // Lookup Plan Logic
        let resolvedPlanName = "Paid Rental Request";
        if (planId) {
             try {
                const plan = await RentalPlan.findById(planId).populate('productId');
                if (plan) {
                    machineModel = plan.productId?.name || plan.planName;
                    machineImage = plan.image?.url || plan.productId?.mainImage?.url;
                    resolvedPlanName = plan.planName;
                }
            } catch (e) { console.error("Plan lookup failed", e);}
        }

        const rentalData = {
            planId: planId || null,
            planName: resolvedPlanName,
            amount: amount || 0,
            status: "Pending",
            machineModel,
            machineImage,
            startDate: new Date(),
            paymentStatus: "Paid",
            paymentId: razorpay_payment_id
        };

        if (customer) {
            if (req.body.isMonthlyRent && customer.rentalDetails && customer.rentalDetails.status === 'Active') {
                // Handle Monthly Rent Payment for Existing Active Customers
                customer.rentalDetails.paymentStatus = "Paid";
                customer.rentalDetails.paymentId = razorpay_payment_id;
                
                // Extend nextDueDate by 1 month
                let currentDue = customer.rentalDetails.nextDueDate ? new Date(customer.rentalDetails.nextDueDate) : new Date();
                // Ensure we don't set a date in the past if they are very late? 
                // For simplicity, just add 30 days to the current due date or now if undefined
                currentDue.setMonth(currentDue.getMonth() + 1);
                customer.rentalDetails.nextDueDate = currentDue;
                
            } else {
                // New Rental or Overwrite
                customer.rentalDetails = rentalData;
            }
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
    }

    // 3. Admin Notification
    try {
        await AdminNotification.create({
            title: "New Paid Rental Booking",
            message: `Payment of ₹${amount} received from ${name} for Rental.`,
            type: "Enquiry",
            refId: enquiry._id
        });
    } catch (e) {
        console.error("Notif error", e);
    }

    res.json({
      success: true,
      message: "Payment successful and booking confirmed",
      enquiryId: enquiry._id
    });

  } catch (err) {
    console.error("verifyRentalPayment error:", err);
    res.status(500).json({ success: false, message: "Server error during verification" });
  }
};
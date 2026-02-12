// routes/paymentRoutes.js
import express from "express";
import {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
  handlePaymentFailure,
  verifyRentalPayment
} from "../controllers/paymentController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

// All payment routes require authentication
router.use(authenticateUser);

// Create Razorpay order
router.post("/create-order", createPaymentOrder);

// Verify payment and create order
router.post("/verify", verifyPaymentAndCreateOrder);

// Handle payment failure
router.post("/failure", handlePaymentFailure);

// Verify rental payment
router.post("/verify-rental", verifyRentalPayment);

export default router;
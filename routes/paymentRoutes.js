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

// Create Razorpay order (public)
router.post("/create-order", createPaymentOrder);

// Verify payment and create order (public)
router.post("/verify", verifyPaymentAndCreateOrder);

// Handle payment failure (public)
router.post("/failure", handlePaymentFailure);

// Verify rental payment (public)
router.post("/verify-rental", verifyRentalPayment);

export default router;
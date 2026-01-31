// routes/paymentRoutes.js
import express from "express";
import {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
  handlePaymentFailure,
} from "../controllers/paymentController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// All payment routes require authentication
router.use(requireAuth);

// Create Razorpay order
router.post("/create-order", createPaymentOrder);

// Verify payment and create order
router.post("/verify", verifyPaymentAndCreateOrder);

// Handle payment failure
router.post("/failure", handlePaymentFailure);

export default router;
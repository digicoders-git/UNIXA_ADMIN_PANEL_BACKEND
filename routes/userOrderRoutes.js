// routes/userOrderRoutes.js
import express from "express";
import {
  placeOrder,
  getUserOrders,
  getOrder,
  cancelOrder,
  returnOrder,
  trackOrder
} from "../controllers/userOrderController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

// All order routes require authentication
router.use(authenticateUser);

router.post("/place", placeOrder);
router.get("/", getUserOrders);
router.get("/:orderId", getOrder);
router.put("/:orderId/cancel", cancelOrder);
router.put("/:orderId/return", returnOrder);
router.get("/:orderId/track", trackOrder);

export default router;
// routes/orderRoutes.js
import express from "express";
import {
  placeOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  getUserOrders,
} from "../controllers/orderController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// public
router.post("/", placeOrder);
router.get("/user/:userId", getUserOrders);


// admin
router.get("/", requireAuth, listOrders);
router.get("/:orderId", requireAuth, getOrder);
router.put("/:orderId/status", requireAuth, updateOrderStatus);

export default router;

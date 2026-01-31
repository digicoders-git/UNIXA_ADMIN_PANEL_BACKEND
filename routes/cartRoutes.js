// routes/cartRoutes.js
import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartTotal
} from "../controllers/cartController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// All cart routes require authentication
router.use(requireAuth);

router.get("/", getCart);
router.get("/total", getCartTotal);
router.post("/add", addToCart);
router.put("/item/:itemId", updateCartItem);
router.delete("/item/:itemId", removeFromCart);
router.delete("/clear", clearCart);

export default router;
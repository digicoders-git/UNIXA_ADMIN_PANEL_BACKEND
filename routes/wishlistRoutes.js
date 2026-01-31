// routes/wishlistRoutes.js
import express from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist
} from "../controllers/wishlistController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticateUser);

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.post("/toggle", toggleWishlist);
router.delete("/:productId", removeFromWishlist);

export default router;
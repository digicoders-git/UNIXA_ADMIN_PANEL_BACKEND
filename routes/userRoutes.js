// routes/userRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} from "../controllers/userController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.get("/profile", authenticateUser, getProfile);
router.put("/profile", authenticateUser, updateProfile);

// Address management
router.get("/addresses", authenticateUser, getAddresses);
router.post("/addresses", authenticateUser, addAddress);
router.put("/addresses/:addressId", authenticateUser, updateAddress);
router.delete("/addresses/:addressId", authenticateUser, deleteAddress);

export default router;
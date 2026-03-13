// routes/userRoutes.js
import express from "express";
import {
  registerUser,
  sendLoginOTP,
  verifyOTPAndLogin,
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  uploadUserProfilePicture,
  getAllUsers
} from "../controllers/userController.js";
import { authenticateUser } from "../middleware/userAuth.js";
import { uploadProfilePicture } from "../config/cloudinary.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);

// Auth routes - these will be accessible as /api/users/auth/send-otp
router.post("/auth/send-otp", sendLoginOTP);
router.post("/auth/verify-otp", verifyOTPAndLogin);

// Protected routes
router.get("/profile", authenticateUser, getProfile);
router.put("/profile", authenticateUser, updateProfile);
router.put("/:id/profile-picture", authenticateUser, uploadProfilePicture, uploadUserProfilePicture);

// Address management
router.get("/addresses", authenticateUser, getAddresses);
router.post("/addresses", authenticateUser, addAddress);
router.put("/addresses/:addressId", authenticateUser, updateAddress);
router.delete("/addresses/:addressId", authenticateUser, deleteAddress);

// Admin routes
router.get("/", getAllUsers);

export default router;
import express from "express";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  loginEmployee,
  getEmployeeStats,
  uploadEmployeeProfilePicture
} from "../controllers/employeeController.js";
import { uploadProfilePicture } from "../config/cloudinary.js";
// import { protect } from "../middleware/authMiddleware.js"; // Assuming there is an auth middleware

const router = express.Router();

import { authenticateAdmin } from "../middleware/adminAuth.js";
import { requireAuth } from "../middleware/auth.js";

router.post("/login", loginEmployee);
router.get("/", requireAuth, getEmployees);
router.get("/:id/stats", getEmployeeStats);
router.post("/", authenticateAdmin, createEmployee);
router.put("/:id", authenticateAdmin, updateEmployee);
router.put("/:id/profile-picture", authenticateAdmin, uploadProfilePicture, uploadEmployeeProfilePicture);
router.delete("/:id", authenticateAdmin, deleteEmployee);

export default router;

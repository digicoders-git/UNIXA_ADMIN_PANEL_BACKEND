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

router.post("/login", loginEmployee);
router.get("/", getEmployees);
router.get("/:id/stats", getEmployeeStats);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.put("/:id/profile-picture", uploadProfilePicture, uploadEmployeeProfilePicture);
router.delete("/:id", deleteEmployee);

export default router;

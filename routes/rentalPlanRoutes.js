import express from "express";
import {
  createRentalPlan,
  getRentalPlans,
  getRentalPlan,
  updateRentalPlan,
  deleteRentalPlan
} from "../controllers/rentalPlanController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadRentalPlanImage } from "../config/cloudinary.js";

const router = express.Router();

// Public
router.get("/", getRentalPlans);
router.get("/:id", getRentalPlan);

// Admin
router.post("/", requireAuth, uploadRentalPlanImage, createRentalPlan);
router.put("/:id", requireAuth, uploadRentalPlanImage, updateRentalPlan);
router.delete("/:id", requireAuth, deleteRentalPlan);

export default router;

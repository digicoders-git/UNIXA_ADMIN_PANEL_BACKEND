import express from "express";
import { createPlan, getPlans, updatePlan, deletePlan } from "../controllers/amcPlanController.js";
import { requireAuth } from "../middleware/auth.js"; // Assuming you want auth for admin actions

const router = express.Router();

// Public route to fetch plans
router.get("/", getPlans);

// Admin routes (Protected)
// Note: You should ideally have an 'isAdmin' middleware check here too.
router.post("/", requireAuth, createPlan);
router.put("/:id", requireAuth, updatePlan);
router.delete("/:id", requireAuth, deletePlan);

export default router;

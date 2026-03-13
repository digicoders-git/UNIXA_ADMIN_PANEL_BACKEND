import express from "express";
import {
  getUpcomingServiceJobs,
  getAmcStatistics,
  getAllAmcs,
  updateNextServiceDueDate
} from "../controllers/amcJobsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Get upcoming service jobs (due within 7 days)
router.get("/upcoming-jobs", requireAuth, getUpcomingServiceJobs);

// Get AMC statistics
router.get("/statistics", requireAuth, getAmcStatistics);

// Get all AMCs with filters
router.get("/all", requireAuth, getAllAmcs);

// Update next service due date
router.put("/:amcId/next-service-date", requireAuth, updateNextServiceDueDate);

export default router;

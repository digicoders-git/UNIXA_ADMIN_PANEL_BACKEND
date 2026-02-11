// routes/userAmcRoutes.js
import express from "express";
import {
  getMyAmcs,
  getAmcDetails,
  getAmcSummary,
  requestService,
  cancelAmc
} from "../controllers/userAmcController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get user's AMCs (with filters)
router.get("/", getMyAmcs);

// Get AMC summary/statistics
router.get("/summary", getAmcSummary);

// Get single AMC details
router.get("/:amcId", getAmcDetails);

// Request service visit
router.post("/:amcId/request-service", requestService);

// Cancel AMC
router.put("/:amcId/cancel", cancelAmc);

export default router;

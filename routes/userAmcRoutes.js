// routes/userAmcRoutes.js
import express from "express";
import {
  getMyAmcs,
  getAmcDetails,
  getAmcSummary,
  requestService,
  cancelAmc,
  getAllUserAmcs,
  getDueAmcs,
  renewAmc
} from "../controllers/userAmcController.js";
import { requireAuth } from "../middleware/auth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin routes
router.get("/admin/all", authenticateAdmin, getAllUserAmcs);
router.get("/admin/due", authenticateAdmin, getDueAmcs);
router.get("/all", authenticateAdmin, getAllUserAmcs);
router.post("/admin/renew/:amcId", authenticateAdmin, renewAmc);

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

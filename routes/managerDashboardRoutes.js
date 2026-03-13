
import express from "express";
import { getManagerDashboardStats, getManagerUserAmcs, getManagerDueAmcs } from "../controllers/managerDashboardController.js";
import { getEmployeeNotifications } from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/stats", getManagerDashboardStats);
router.get("/user-amcs", getManagerUserAmcs);
router.get("/due-amcs", getManagerDueAmcs);
router.get("/notifications", requireAuth, getEmployeeNotifications);

export default router;

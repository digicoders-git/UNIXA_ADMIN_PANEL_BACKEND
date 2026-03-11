
import express from "express";
import { getManagerDashboardStats, getManagerUserAmcs, getManagerDueAmcs } from "../controllers/managerDashboardController.js";

const router = express.Router();

router.get("/stats", getManagerDashboardStats);
router.get("/user-amcs", getManagerUserAmcs);
router.get("/due-amcs", getManagerDueAmcs);

export default router;

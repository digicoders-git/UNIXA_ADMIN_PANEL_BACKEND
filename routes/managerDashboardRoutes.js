
import express from "express";
import { getManagerDashboardStats } from "../controllers/managerDashboardController.js";

const router = express.Router();

router.get("/stats", getManagerDashboardStats);

export default router;

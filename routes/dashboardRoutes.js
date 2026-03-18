import express from "express";
import { getDashboardStats, getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/summary", getDashboardSummary);
router.get("/overview", getDashboardStats);

export default router;

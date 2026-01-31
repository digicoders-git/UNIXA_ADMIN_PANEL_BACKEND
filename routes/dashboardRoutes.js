// routes/dashboardRoutes.js
import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";

const router = express.Router();

// If you have admin auth middleware, you can protect it like:
// import { verifyAdmin } from "../middleware/authMiddleware.js";
// router.get("/overview", verifyAdmin, getDashboardStats);

router.get("/overview", getDashboardStats);

export default router;

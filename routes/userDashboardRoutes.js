
import express from "express";
import { getUserDashboardStats } from "../controllers/userDashboardController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/overview", authenticateUser, getUserDashboardStats);

export default router;

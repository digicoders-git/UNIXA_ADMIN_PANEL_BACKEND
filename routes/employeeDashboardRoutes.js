
import express from "express";
import { getEmployeeDashboardStats } from "../controllers/employeeDashboardController.js";

const router = express.Router();

router.get("/stats", getEmployeeDashboardStats);

export default router;

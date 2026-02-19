
import express from "express";
import { getEmployeeDashboardStats, getEmployeeComplaints } from "../controllers/employeeDashboardController.js";

const router = express.Router();

router.get("/stats", getEmployeeDashboardStats);
router.get("/complaints", getEmployeeComplaints);

export default router;

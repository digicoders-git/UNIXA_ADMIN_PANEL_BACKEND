
import express from "express";
import { getEmployeeDashboardStats, getEmployeeComplaints, getTicketTypes, getTicketMetadata, createComplaint, updateComplaint, deleteComplaint } from "../controllers/employeeDashboardController.js";

const router = express.Router();

router.get("/stats", getEmployeeDashboardStats);
router.get("/complaints", getEmployeeComplaints);
router.get("/ticket-types", getTicketTypes);
router.get("/ticket-metadata", getTicketMetadata);
router.post("/complaints", createComplaint);
router.put("/complaints/:complaintId", updateComplaint);
router.delete("/complaints/:complaintId", deleteComplaint);

export default router;

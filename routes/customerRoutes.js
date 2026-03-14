import express from "express";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addService,
  addComplaint,
  getAMCDashboard,
  createAMC,
  renewAMC,
  getAllComplaints,
  updateComplaintStatus,
  deleteComplaint,
  getCustomerCompleteHistory
} from "../controllers/customerController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// ⚠️ SPECIFIC ROUTES FIRST (before :id routes)
router.get("/complaints/all", getAllComplaints); // Get aggregated complaints
router.get("/amc/dashboard", getAMCDashboard); // Get AMC dashboard
router.post("/amc/new", createAMC); // Create new AMC for a customer
router.get("/:id/complete-history", getCustomerCompleteHistory); // Get complete customer history - MUST BE BEFORE generic :id

// ⚠️ THEN :id routes (specific patterns) - BEFORE generic :id route
router.put("/complaints/:ticketId", updateComplaintStatus); // Update complaint status
router.delete("/complaints/:ticketId", deleteComplaint); // Delete complaint
router.post("/:id/amc/renew", renewAMC); // Renew AMC for a customer

// ⚠️ GENERIC CRUD routes LAST
router.get("/", getCustomers);
router.post("/", createCustomer);
router.get("/:id", getCustomerById);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

// Sub-resource routes
router.post("/:id/services", addService);
router.post("/:id/complaints", addComplaint);

export default router;

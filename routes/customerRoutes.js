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
  updateComplaintStatus
} from "../controllers/customerController.js";

const router = express.Router();

router.put("/complaints/:ticketId", updateComplaintStatus); // Update complaint status
router.get("/amc/dashboard", getAMCDashboard);
router.post("/amc/new", createAMC); // Create new AMC for a customer
router.post("/:id/amc/renew", renewAMC); // Renew AMC for a customer

router.get("/complaints/all", getAllComplaints); // Get aggregated complaints
router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.post("/", createCustomer);
router.put("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

// Sub-resource routes
router.post("/:id/services", addService);
router.post("/:id/complaints", addComplaint);

export default router;

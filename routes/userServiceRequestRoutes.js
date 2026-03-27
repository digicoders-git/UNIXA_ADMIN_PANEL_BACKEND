
import express from "express";
import { createServiceRequest, getUserServiceRequests, getUserItemsForComplaint } from "../controllers/userServiceRequestController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/complaint-items", authenticateUser, getUserItemsForComplaint);
router.post("/", authenticateUser, createServiceRequest);
router.get("/", authenticateUser, getUserServiceRequests);

export default router;

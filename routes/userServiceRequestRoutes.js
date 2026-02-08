
import express from "express";
import { createServiceRequest, getUserServiceRequests } from "../controllers/userServiceRequestController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

router.post("/", authenticateUser, createServiceRequest);
router.get("/", authenticateUser, getUserServiceRequests);

export default router;

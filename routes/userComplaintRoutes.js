import express from "express";
import { createComplaint, getUserComplaints, getComplaintItems } from "../controllers/userComplaintController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/items", authenticateUser, getComplaintItems);
router.post("/", authenticateUser, createComplaint);
router.get("/", authenticateUser, getUserComplaints);

export default router;

import express from "express";
import { getAllComplaints, updateComplaint, deleteComplaint, getAvailableComplaints, createOfflineComplaint, searchUsersForComplaint } from "../controllers/adminComplaintController.js";

const router = express.Router();

router.get("/available", getAvailableComplaints);
router.get("/search-users", searchUsersForComplaint);
router.get("/", getAllComplaints);
router.post("/offline", createOfflineComplaint);
router.put("/:complaintId", updateComplaint);
router.delete("/:complaintId", deleteComplaint);

export default router;

import express from "express";
import { getAllComplaints, updateComplaint, deleteComplaint, getAvailableComplaints } from "../controllers/adminComplaintController.js";

const router = express.Router();

router.get("/available", getAvailableComplaints);
router.get("/", getAllComplaints);
router.put("/:complaintId", updateComplaint);
router.delete("/:complaintId", deleteComplaint);

export default router;

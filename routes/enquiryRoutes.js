// routes/enquiryRoutes.js
import express from "express";
import {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiryStatus,
} from "../controllers/enquiryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// public
router.post("/", createEnquiry);

// admin
router.get("/", requireAuth, listEnquiries);
router.get("/:id", requireAuth, getEnquiry);
router.put("/:id", requireAuth, updateEnquiryStatus);

export default router;

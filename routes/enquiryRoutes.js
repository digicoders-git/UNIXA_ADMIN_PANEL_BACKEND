// routes/enquiryRoutes.js
import express from "express";
import {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry
} from "../controllers/enquiryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// public
router.post("/", createEnquiry);

// admin/manager (assuming requireAuth handles both or we add manager middleware if needed later)
// For now adhering to existing pattern.
router.get("/", requireAuth, listEnquiries);
router.get("/:id", requireAuth, getEnquiry);
router.put("/:id", requireAuth, updateEnquiry);
router.delete("/:id", requireAuth, deleteEnquiry);

export default router;

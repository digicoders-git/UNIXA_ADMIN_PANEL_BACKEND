import express from "express";
import { createLead, listLeads, getLead, updateLead, deleteLead, verifyLead, scheduleService, updateScheduleStatus } from "../controllers/leadController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, createLead);
router.get("/", requireAuth, listLeads);
router.get("/:id", requireAuth, getLead);
router.put("/:id", requireAuth, updateLead);
router.delete("/:id", requireAuth, deleteLead);
router.patch("/:id/verify", requireAuth, verifyLead);
router.patch("/:id/schedule", requireAuth, scheduleService);
router.patch("/:id/schedule-status", requireAuth, updateScheduleStatus);

export default router;

import express from "express";
import { createLead, listLeads, getLead, updateLead, deleteLead } from "../controllers/leadController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", requireAuth, createLead);
router.get("/", requireAuth, listLeads);
router.get("/:id", requireAuth, getLead);
router.put("/:id", requireAuth, updateLead);
router.delete("/:id", requireAuth, deleteLead);

export default router;

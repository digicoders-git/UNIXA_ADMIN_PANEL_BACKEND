import express from "express";
import { getRentalTracking, updateRentalStatus } from "../controllers/rentalTrackingController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/", authenticateAdmin, getRentalTracking);
router.put("/:id", authenticateAdmin, updateRentalStatus);

export default router;

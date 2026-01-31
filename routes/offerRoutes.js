// routes/offerRoutes.js
import express from "express";
import {
  createOffer,
  listOffers,
  getOfferByCode,
  updateOffer,
  deleteOffer,
} from "../controllers/offerController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// public check by code (for checkout)
router.get("/code/:code", getOfferByCode);

// admin
router.get("/", requireAuth, listOffers);
router.post("/", requireAuth, createOffer);
router.put("/:id", requireAuth, updateOffer);
router.delete("/:id", requireAuth, deleteOffer);

export default router;

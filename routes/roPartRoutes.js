// routes/roPartRoutes.js
import express from "express";
import {
  createRoPart,
  listRoParts,
  getRoPart,
  updateRoPart,
  deleteRoPart,
} from "../controllers/roPartController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadRoPartImage } from "../config/cloudinary.js";

const router = express.Router();

router.get("/", listRoParts);
router.get("/:id", getRoPart);

router.post("/", requireAuth, uploadRoPartImage, createRoPart);
router.put("/:id", requireAuth, uploadRoPartImage, updateRoPart);
router.delete("/:id", requireAuth, deleteRoPart);

export default router;

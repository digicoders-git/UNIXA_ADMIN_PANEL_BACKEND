// routes/sliderRoutes.js
import express from "express";
import {
  createSlider,
  listActiveSliders,
  listAllSliders,
  updateSlider,
  deleteSlider,
} from "../controllers/sliderController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadSliderImage } from "../config/cloudinary.js";

const router = express.Router();

// public
router.get("/", listActiveSliders);

// admin
router.get("/all", requireAuth, listAllSliders);
router.post("/", requireAuth, uploadSliderImage, createSlider);
router.put("/:id", requireAuth, uploadSliderImage, updateSlider);
router.delete("/:id", requireAuth, deleteSlider);

export default router;

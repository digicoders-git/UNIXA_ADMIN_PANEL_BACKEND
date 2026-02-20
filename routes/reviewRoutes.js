import express from "express";
import { addReview, getProductReviews, getAllReviews, getSliderReviews, getAdminReviews, approveReview, deleteReview } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/add", addReview);
router.get("/all", getAllReviews);
router.get("/slider", getSliderReviews);
router.get("/admin/all", getAdminReviews);
router.put("/admin/approve/:id", approveReview);
router.delete("/admin/:id", deleteReview);
router.get("/:productId", getProductReviews);

export default router;

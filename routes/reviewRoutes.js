import express from "express";
import { addReview, getProductReviews, getAllReviews } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/add", addReview);
router.get("/all", getAllReviews);
router.get("/:productId", getProductReviews);

export default router;

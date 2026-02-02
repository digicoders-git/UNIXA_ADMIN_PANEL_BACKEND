import express from "express";
import {
  getRefunds,
  createRefundRequest,
  updateRefundStatus,
  deleteRefundRequest
} from "../controllers/refundController.js";

const router = express.Router();

router.get("/", getRefunds);
router.post("/", createRefundRequest);
router.put("/:id", updateRefundStatus);
router.delete("/:id", deleteRefundRequest);

export default router;

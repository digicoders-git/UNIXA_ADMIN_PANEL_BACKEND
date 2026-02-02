import express from "express";
import {
  getStockOverview,
  updateStock,
  getStockHistory
} from "../controllers/stockController.js";

const router = express.Router();

router.get("/", getStockOverview);
router.post("/update", updateStock);
router.get("/history/:id", getStockHistory);

export default router;

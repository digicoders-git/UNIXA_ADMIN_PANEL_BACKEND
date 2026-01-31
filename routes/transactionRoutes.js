// routes/transactionRoutes.js
import express from "express";
import { getAllTransactions, createTransaction } from "../controllers/transactionController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Admin: Get all transactions
router.get("/all", requireAuth, getAllTransactions);

// Internal/Protected: Create a transaction
router.post("/create", requireAuth, createTransaction);

export default router;

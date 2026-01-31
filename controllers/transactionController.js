// controllers/transactionController.js
import Transaction from "../models/Transaction.js";

// Get all transactions (for Admin)
export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("userId", "name email phone")
      .populate("orderId", "total status")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Create a transaction record (usually called internally after payment)
export const createTransaction = async (req, res) => {
    try {
        const { transactionId, orderId, userId, amount, status, paymentMethod, description } = req.body;

        const transaction = new Transaction({
            transactionId,
            orderId,
            userId,
            amount,
            status,
            paymentMethod,
            description
        });

        await transaction.save();
        res.status(201).json({ success: true, transaction });
    } catch (error) {
        console.error("Error creating transaction:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

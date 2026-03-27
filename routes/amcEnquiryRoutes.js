import express from "express";
import { createAmcEnquiry, listEnquiries, verifyEnquiry, rejectEnquiry, activateAmcFromEnquiry, getCustomerOrdersByPhone, getOrdersByPhonePublic } from "../controllers/amcEnquiryController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Public: get delivered orders by phone (for website AMC booking)
router.get("/orders-by-phone/:phone", getOrdersByPhonePublic);

// User/Website: submit AMC request (optional auth)
router.post("/", (req, res, next) => {
  requireAuth(req, res, () => next());
}, createAmcEnquiry);

// Also allow unauthenticated (website visitors)
router.post("/guest", createAmcEnquiry);

// Admin routes
router.get("/admin", authenticateAdmin, listEnquiries);
router.get("/admin/customer/:phone", authenticateAdmin, getCustomerOrdersByPhone);
router.put("/admin/:id/verify", authenticateAdmin, verifyEnquiry);
router.put("/admin/:id/reject", authenticateAdmin, rejectEnquiry);
router.post("/admin/:id/activate", authenticateAdmin, activateAmcFromEnquiry);

export default router;

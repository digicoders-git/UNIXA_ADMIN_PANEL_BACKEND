import express from "express";
import {
  getNotifications,
  sendNotification,
  deleteNotification,
  getAdminNotifications,
  markAdminNotificationsRead,
  getUserNotifications,
  markUserNotificationsRead,
  createSpecificNotification,
  getEmployeeNotifications
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Temporarily removed auth for testing
router.get("/admin/unread", getAdminNotifications);
router.put("/admin/mark-read", markAdminNotificationsRead);
router.get("/user", requireAuth, getUserNotifications);
router.put("/user/mark-read", requireAuth, markUserNotificationsRead);
router.post("/user-notifications", createSpecificNotification);
router.get("/employee", requireAuth, getEmployeeNotifications);
router.get("/", getNotifications);
router.post("/send", sendNotification);
router.delete("/:id", deleteNotification);

export default router;

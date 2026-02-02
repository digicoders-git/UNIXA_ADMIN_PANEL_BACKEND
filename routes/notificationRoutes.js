import express from "express";
import {
  getNotifications,
  sendNotification,
  deleteNotification
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", getNotifications);
router.post("/send", sendNotification);
router.delete("/:id", deleteNotification);

export default router;

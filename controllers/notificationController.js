import Notification from "../models/Notification.js";
import AdminNotification from "../models/AdminNotification.js";
import UserNotification from "../models/UserNotification.js";

// Get All Notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send (Create) Notification
export const sendNotification = async (req, res) => {
  try {
    const { title, message, audience, type } = req.body;
    
    // Logic to actually send push notifications / emails could go here in future
    // For now, we just save to DB for the "in-app" notification history/feed
    
    const notification = new Notification({
        title,
        message,
        audience,
        type,
        status: "Sent",
        sentAt: new Date()
    });

    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete Notification
export const deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Unread Admin Notifications
export const getAdminNotifications = async (req, res) => {
    try {
        const notifications = await AdminNotification.find({ isRead: false }).sort({ createdAt: -1 }).limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark Admin Notifications as Read
export const markAdminNotificationsRead = async (req, res) => {
    try {
        await AdminNotification.updateMany({ isRead: false }, { $set: { isRead: true } });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- USER PANEL NOTIFICATIONS ---

// Get User Notifications (individual)
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.sub; // From auth middleware
        const notifications = await UserNotification.find({ userId }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark User Notifications as Read
export const markUserNotificationsRead = async (req, res) => {
    try {
        const userId = req.user.sub;
        await UserNotification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
        res.json({ message: "Notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


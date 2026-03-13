import Notification from "../models/Notification.js";
import AdminNotification from "../models/AdminNotification.js";
import UserNotification from "../models/UserNotification.js";
import EmployeeNotification from "../models/EmployeeNotification.js";
import Employee from "../models/Employee.js";
import moment from "moment";

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

// Get User Notifications (individual + broadcast)
export const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.sub; // From auth middleware
        
        // Fetch specific notifications for this user
        const personalNotifications = await UserNotification.find({ userId }).lean();
        
        // Fetch broadcast notifications for all or customers
        const broadcastNotifications = await Notification.find({ 
            audience: { $in: ["All", "Customers"] },
            status: "Sent"
        }).lean();

        // Combine and format
        const allNotifications = [
            ...personalNotifications.map(n => ({ ...n, isBroadcast: false })),
            ...broadcastNotifications.map(n => ({ ...n, isBroadcast: true }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(allNotifications);
    } catch (error) {
        console.error("getUserNotifications error:", error);
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

// --- EMPLOYEE/MANAGER PANEL NOTIFICATIONS ---

// Get Employee Notifications (individual + broadcast)
export const getEmployeeNotifications = async (req, res) => {
    try {
        const employeeId = req.user.sub || req.user.id || req.user._id;
        
        // Fetch specific notifications for this employee
        const personalNotifications = await EmployeeNotification.find({ employeeId }).lean();
        
        // Fetch broadcast notifications for all or employees
        const broadcastNotifications = await Notification.find({ 
            audience: { $in: ["All", "Employees"] },
            status: "Sent"
        }).lean();

        // Combine and format
        const allNotifications = [
            ...personalNotifications.map(n => ({ 
              id: n._id, 
              title: n.title,
              description: n.message, 
              status: n.isRead ? 'read' : 'unread', 
              type: n.type?.toLowerCase() || 'info',
              priority: 'medium',
              isBroadcast: false, 
              time: moment(n.createdAt).fromNow() 
            })),
            ...broadcastNotifications.map(n => ({ 
              id: n._id, 
              title: n.title,
              description: n.message, 
              status: 'unread', 
              type: 'system',
              priority: 'low',
              isBroadcast: true, 
              time: moment(n.sentAt).fromNow() 
            }))
        ].sort((a, b) => new Date(b.createdAt || b.sentAt) - new Date(a.createdAt || a.sentAt));

        res.json({ notifications: allNotifications });
    } catch (error) {
        console.error("getEmployeeNotifications error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Create Specific Notification (handles both User and Employee)
export const createSpecificNotification = async (req, res) => {
    try {
        const { userId, title, message, type } = req.body;
        
        if (!userId || !title || !message) {
            return res.status(400).json({ message: "userId (targetId), title, and message are required" });
        }

        let notification;
        // Check if target is Employee or User
        const employee = await Employee.findById(userId);
        if (employee) {
            notification = await EmployeeNotification.create({
                employeeId: userId,
                title,
                message,
                type: type || 'Info',
                isRead: false
            });
        } else {
            notification = await UserNotification.create({
                userId: userId,
                title,
                message,
                type: type || 'Info',
                isRead: false
            });
        }

        // Also save to global history
        await Notification.create({
            title,
            message,
            audience: "Specific",
            type: type || 'Info',
            status: "Sent",
            sentAt: new Date()
        });
        
        res.status(201).json({ message: "Notification created", notification });
    } catch (error) {
        console.error("createSpecificNotification error:", error);
        res.status(500).json({ message: error.message });
    }
};


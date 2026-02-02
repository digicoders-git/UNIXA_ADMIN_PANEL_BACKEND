import Notification from "../models/Notification.js";

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
}

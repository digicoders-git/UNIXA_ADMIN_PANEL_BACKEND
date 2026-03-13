import SMSMessage from "../models/SMSMessage.js";
import Customer from "../models/Customer.js";

// Send SMS (Generic)
export const sendSMS = async (req, res) => {
  try {
    const { mobile, phone, message } = req.body;
    const phoneNumber = mobile || phone;

    if (!phoneNumber || !message) {
      return res.status(400).json({ message: "Phone/mobile and message are required" });
    }

    // Save to DB
    await SMSMessage.create({
      phoneNumber,
      message,
      direction: "outbound",
      status: "sent"
    });

    // TODO: Integrate with SMS provider
    console.log(`[SMS OUT] ${phoneNumber}: ${message}`);
    
    res.status(200).json({ message: "SMS sent successfully", phone: phoneNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Conversations (Last message from each phone)
export const getSMSConversations = async (req, res) => {
  try {
    const conversations = await SMSMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$phoneNumber",
          lastMessage: { $first: "$message" },
          lastDate: { $first: "$createdAt" },
          unreadCount: {
            $sum: { $cond: [{ $and: [{ $eq: ["$direction", "inbound"] }, { $eq: ["$isRead", false] }] }, 1, 0] }
          },
          direction: { $first: "$direction" }
        }
      },
      { $sort: { lastDate: -1 } }
    ]);

    // Populate names from Customer model if exists
    const populated = await Promise.all(conversations.map(async (c) => {
      const customer = await Customer.findOne({ phone: c._id }).select('firstName lastName');
      return {
        ...c,
        phoneNumber: c._id,
        name: customer ? `${customer.firstName} ${customer.lastName}` : "Unknown Customer"
      };
    }));

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Conversation History for a specific number
export const getSMSHistory = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const messages = await SMSMessage.find({ phoneNumber }).sort({ createdAt: 1 });
    
    // Mark as read
    await SMSMessage.updateMany({ phoneNumber, direction: "inbound", isRead: false }, { isRead: true });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reply to a message (Admin -> Customer)
export const replyToSMS = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ message: "PhoneNumber and message are required" });
    }

    const newMessage = await SMSMessage.create({
      phoneNumber,
      message,
      direction: "outbound",
      status: "sent"
    });

    // TODO: Integrate with real SMS gateway here
    console.log(`[SMS REPLY] ${phoneNumber}: ${message}`);

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Simulate an Incoming SMS (For Testing)
export const simulateIncomingSMS = async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        const msg = await SMSMessage.create({
            phoneNumber,
            message,
            direction: "inbound",
            status: "received"
        });
        res.status(201).json(msg);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

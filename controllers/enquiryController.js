// controllers/enquiryController.js
import Enquiry from "../models/Enquiry.js";

export const createEnquiry = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: "name and message required" });
    }
    const enquiry = await Enquiry.create({
      name,
      email,
      phone,
      subject,
      message,
    });
    res.status(201).json({ message: "Enquiry submitted", enquiry });
  } catch (err) {
    console.error("createEnquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listEnquiries = async (_req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json({ enquiries });
  } catch (err) {
    console.error("listEnquiries error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ message: "Not found" });
    res.json({ enquiry });
  } catch (err) {
    console.error("getEnquiry error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isRead } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ message: "Not found" });

    if (status) enquiry.status = status;
    if (isRead !== undefined) enquiry.isRead = !!isRead;

    await enquiry.save();
    res.json({ message: "Enquiry updated", enquiry });
  } catch (err) {
    console.error("updateEnquiryStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

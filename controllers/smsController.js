export const sendSMS = async (req, res) => {
  try {
    const { mobile, phone, message } = req.body;
    const phoneNumber = mobile || phone;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ message: "Phone/mobile and message are required" });
    }

    // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
    console.log(`SMS to ${phoneNumber}: ${message}`);
    
    res.status(200).json({ message: "SMS sent successfully", phone: phoneNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

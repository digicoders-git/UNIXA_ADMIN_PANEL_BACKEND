import express from "express";
import { 
  sendSMS, 
  getSMSConversations, 
  getSMSHistory, 
  replyToSMS, 
  simulateIncomingSMS 
} from "../controllers/smsController.js";

const router = express.Router();

router.post("/send", sendSMS);
router.get("/conversations", getSMSConversations);
router.get("/history/:phoneNumber", getSMSHistory);
router.post("/reply", replyToSMS);
router.post("/simulate-incoming", simulateIncomingSMS);

export default router;

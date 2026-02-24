import express from "express";
import {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry
} from "../controllers/enquiryController.js";

const router = express.Router();

router.post("/", createEnquiry);
router.get("/", listEnquiries);
router.get("/:id", getEnquiry);
router.put("/:id", updateEnquiry);
router.delete("/:id", deleteEnquiry);

export default router;

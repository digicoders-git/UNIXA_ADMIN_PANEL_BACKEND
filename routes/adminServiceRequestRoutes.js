import express from "express";
import { getAllServiceRequests, updateServiceRequest, deleteServiceRequest } from "../controllers/adminServiceRequestController.js";

const router = express.Router();

router.get("/", getAllServiceRequests);
router.put("/:ticketId", updateServiceRequest);
router.delete("/:ticketId", deleteServiceRequest);

export default router;

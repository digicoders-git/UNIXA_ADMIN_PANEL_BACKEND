
import express from "express";
import { getUserRentalDetails } from "../controllers/userRentalController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/", authenticateUser, getUserRentalDetails);

export default router;

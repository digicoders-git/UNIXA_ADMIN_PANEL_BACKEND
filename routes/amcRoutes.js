import express from "express";
import { 
    getMyAMC, 
    purchaseAMC, 
    renewAMC, 
    createServiceRequest 
} from "../controllers/amcController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const router = express.Router();

// All routes require login
router.use(authenticateUser);

router.get("/my-subscriptions", getMyAMC);
router.post("/subscribe", purchaseAMC);
router.post("/renew", renewAMC);
router.post("/request-service", createServiceRequest);

export default router;

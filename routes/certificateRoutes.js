import express from "express";
import { getCertificates, getActiveCertificates, addCertificate, updateCertificate, deleteCertificate } from "../controllers/certificateController.js";

const router = express.Router();

router.get("/", getCertificates);
router.get("/active", getActiveCertificates);
router.post("/", addCertificate);
router.put("/:id", updateCertificate);
router.delete("/:id", deleteCertificate);

export default router;

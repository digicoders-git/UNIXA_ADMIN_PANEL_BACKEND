import express from "express";
import {
  getAssets,
  getMyAssets,
  addAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  reassignAsset,
  deleteAsset
} from "../controllers/employeeAssetController.js";

const router = express.Router();

router.get("/", getAssets);
router.get("/my-assets/:employeeId", getMyAssets);
router.post("/", addAsset);
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);
router.post("/:id/assign", assignAsset);
router.post("/:id/return", returnAsset);
router.post("/:id/reassign", reassignAsset);

export default router;

import express from "express";
import {
  getAssets,
  addAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  deleteAsset
} from "../controllers/employeeAssetController.js";

const router = express.Router();

router.get("/", getAssets);
router.post("/", addAsset);
router.put("/:id", updateAsset);
router.delete("/:id", deleteAsset);
router.post("/:id/assign", assignAsset);
router.post("/:id/return", returnAsset);

export default router;

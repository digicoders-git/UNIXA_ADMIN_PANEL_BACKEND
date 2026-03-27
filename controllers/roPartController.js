// controllers/roPartController.js
import fs from "fs";
import mongoose from "mongoose";
import RoPart from "../models/RoPart.js";
import Category from "../models/Category.js";
import { fileToUrl } from "../config/cloudinary.js";

const deleteLocalFile = (p) => { if (p && fs.existsSync(p)) fs.unlinkSync(p); };

/* ================= CREATE ================= */

export const createRoPart = async (req, res) => {
  try {
    const {
      name,
      brand,
      price,
      discountPercent,
      description,
      categoryId,
      isActive,
      p_id,
      warrantyYears,
      stock,
    } = req.body;

    if (!name || !price || !categoryId || !p_id) {
      return res
        .status(400)
        .json({ message: "name, price, categoryId, p_id required" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "mainImage is required" });
    }

    const roPart = await RoPart.create({
      p_id,
      name,
      brand: brand || "",
      category: category._id,
      price: Number(price),
      discountPercent: Math.max(0, Math.min(100, Number(discountPercent || 0))),
      mainImage: { url: fileToUrl(req.file), publicId: req.file.path },
      description,
      warrantyYears: Number(warrantyYears || 0),
      stock: Number(stock || 0),
      isActive: isActive === "false" ? false : true,
    });

    res.status(201).json({ message: "RO Part created", roPart });
  } catch (err) {
    console.error("createRoPart error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ================= LIST ================= */

export const listRoParts = async (req, res) => {
  try {
    const { all } = req.query;
    const match = all === "true" ? {} : { isActive: true, showOnWebsite: true };
    
    const roParts = await RoPart.find(match)
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.json({ roParts });
  } catch (err) {
    console.error("listRoParts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET SINGLE ================= */

export const getRoPart = async (req, res) => {
  try {
    const { id } = req.params;
    let roPart = await RoPart.findOne({ p_id: id }).populate("category", "name slug");

    if (!roPart && mongoose.Types.ObjectId.isValid(id)) {
      roPart = await RoPart.findById(id).populate("category", "name slug");
    }

    if (!roPart) {
      return res.status(404).json({ message: "RO Part not found" });
    }

    res.json({ roPart });
  } catch (err) {
    console.error("getRoPart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE ================= */

export const updateRoPart = async (req, res) => {
  try {
    const { id } = req.params;
    let roPart = await RoPart.findOne({ p_id: id });
    if (!roPart && mongoose.Types.ObjectId.isValid(id)) {
      roPart = await RoPart.findById(id);
    }

    if (!roPart) {
      return res.status(404).json({ message: "RO Part not found" });
    }

    const {
      name,
      brand,
      price,
      discountPercent,
      description,
      categoryId,
      isActive,
      p_id,
      warrantyYears,
      stock,
    } = req.body;

    if (p_id) roPart.p_id = p_id;
    if (name) roPart.name = name;
    if (brand !== undefined) roPart.brand = brand;
    if (warrantyYears !== undefined) roPart.warrantyYears = Number(warrantyYears);
    if (stock !== undefined) roPart.stock = Number(stock);
    if (price !== undefined) roPart.price = Number(price);
    if (discountPercent !== undefined)
      roPart.discountPercent = Math.max(0, Math.min(100, Number(discountPercent)));

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category)
        return res.status(400).json({ message: "Invalid categoryId" });
      roPart.category = category._id;
    }

    if (description !== undefined) roPart.description = description;

    if (isActive !== undefined)
      roPart.isActive = isActive === true || isActive === "true";
    if (req.body.showOnWebsite !== undefined)
      roPart.showOnWebsite = req.body.showOnWebsite === true || req.body.showOnWebsite === "true";

    if (req.file) {
      deleteLocalFile(roPart.mainImage?.publicId);
      roPart.mainImage = { url: fileToUrl(req.file), publicId: req.file.path };
    }

    await roPart.save();
    res.json({ message: "RO Part updated", roPart });
  } catch (err) {
    console.error("updateRoPart error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ================= DELETE ================= */

export const deleteRoPart = async (req, res) => {
  try {
    const { id } = req.params;
    let roPart = await RoPart.findOne({ p_id: id });
    if (!roPart && mongoose.Types.ObjectId.isValid(id)) {
      roPart = await RoPart.findById(id);
    }

    if (!roPart) {
      return res.status(404).json({ message: "RO Part not found" });
    }

    deleteLocalFile(roPart.mainImage?.publicId);
    await RoPart.deleteOne({ _id: roPart._id });
    res.json({ message: "RO Part deleted" });
  } catch (err) {
    console.error("deleteRoPart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

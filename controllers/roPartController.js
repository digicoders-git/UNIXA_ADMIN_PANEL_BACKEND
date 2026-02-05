// controllers/roPartController.js
import mongoose from "mongoose";
import RoPart from "../models/RoPart.js";
import Category from "../models/Category.js";
import { cloudinary } from "../config/cloudinary.js";

/* ================= CREATE ================= */

export const createRoPart = async (req, res) => {
  try {
    const {
      name,
      price,
      discountPercent,
      description,
      categoryId,
      isActive,
    } = req.body;

    if (!name || !price || !categoryId) {
      return res
        .status(400)
        .json({ message: "name, price, categoryId required" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "mainImage is required" });
    }

    const roPart = await RoPart.create({
      name,
      category: category._id,
      price: Number(price),
      discountPercent: Number(discountPercent || 0),
      mainImage: {
        url: req.file.path,
        publicId: req.file.filename,
      },
      description,
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
    const match = all === "true" ? {} : { isActive: true };
    
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const roPart = await RoPart.findById(id).populate("category", "name slug");
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
    let roPart = await RoPart.findById(id);

    if (!roPart) {
      return res.status(404).json({ message: "RO Part not found" });
    }

    const {
      name,
      price,
      discountPercent,
      description,
      categoryId,
      isActive,
    } = req.body;

    if (name) roPart.name = name;
    if (price !== undefined) roPart.price = Number(price);
    if (discountPercent !== undefined)
      roPart.discountPercent = Number(discountPercent);

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category)
        return res.status(400).json({ message: "Invalid categoryId" });
      roPart.category = category._id;
    }

    if (description !== undefined) roPart.description = description;
    if (isActive !== undefined)
      roPart.isActive = isActive === true || isActive === "true";

    if (req.file) {
      if (roPart.mainImage?.publicId) {
        await cloudinary.uploader.destroy(roPart.mainImage.publicId).catch(err => console.log("Cloudinary destroy error:", err));
      }
      roPart.mainImage = { url: req.file.path, publicId: req.file.filename };
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
    const roPart = await RoPart.findById(id);

    if (!roPart) {
      return res.status(404).json({ message: "RO Part not found" });
    }

    if (roPart.mainImage?.publicId) {
      await cloudinary.uploader.destroy(roPart.mainImage.publicId).catch(err => console.log("Del error:", err));
    }

    await RoPart.deleteOne({ _id: roPart._id });
    res.json({ message: "RO Part deleted" });
  } catch (err) {
    console.error("deleteRoPart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

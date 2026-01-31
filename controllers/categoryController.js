import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { cloudinary } from "../config/cloudinary.js";
import mongoose from "mongoose";

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const exists = await Category.findOne({ name });
    if (exists) return res.status(409).json({ message: "Category exists" });

    const category = await Category.create({ 
      name, 
      description,
      image: req.file ? { url: req.file.path, publicId: req.file.filename } : { url: "", publicId: "" }
    });
    res.status(201).json({ message: "Category created", category });
  } catch (err) {
    console.error("createCategory error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listCategories = async (_req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      name: 1,
    });
    res.json({ categories });
  } catch (err) {
    console.error("listCategories error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCategory = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let query = { slug: idOrSlug };

    // Check if idOrSlug is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      query = { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] };
    }

    const category = await Category.findOne(query);
    if (!category) return res.status(404).json({ message: "Not found" });
    res.json({ category });
  } catch (err) {
    console.error("getCategory error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let query = { slug: idOrSlug };
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      query = { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] };
    }
    const category = await Category.findOne(query);
    if (!category) return res.status(404).json({ message: "Not found" });

    const { name, description, isActive } = req.body;

    if (name) {
      category.name = name;
      category.slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "") + "-" + Date.now();
    }
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) {
      category.isActive = isActive === "true" || isActive === true;
    }

    if (req.file) {
      if (category.image && category.image.publicId) {
        await cloudinary.uploader.destroy(category.image.publicId);
      }
      category.image = { url: req.file.path, publicId: req.file.filename };
    }

    await category.save();
    res.json({ message: "Category updated", category });
  } catch (err) {
    console.error("updateCategory error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let query = { slug: idOrSlug };
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      query = { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] };
    }
    const category = await Category.findOne(query);
    if (!category) return res.status(404).json({ message: "Not found" });

    const productCount = await Product.countDocuments({
      category: category._id,
    });
    if (productCount > 0) {
      return res
        .status(400)
        .json({ message: "Category has products, cannot delete" });
    }

    if (category.image && category.image.publicId) {
      await cloudinary.uploader.destroy(category.image.publicId);
    }

    await Category.deleteOne({ _id: category._id });
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("deleteCategory error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

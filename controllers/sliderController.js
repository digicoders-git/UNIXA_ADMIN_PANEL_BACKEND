// controllers/sliderController.js
import Slider from "../models/Slider.js";
import { cloudinary } from "../config/cloudinary.js";

export const createSlider = async (req, res) => {
  try {
    const { title, subtitle, buttonText, linkUrl, sortOrder } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });
    if (!req.file) return res.status(400).json({ message: "image is required" });

    const slider = await Slider.create({
      title,
      subtitle,
      buttonText,
      linkUrl,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      image: { url: req.file.path, publicId: req.file.filename },
    });

    res.status(201).json({ message: "Slider created", slider });
  } catch (err) {
    console.error("createSlider error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listActiveSliders = async (_req, res) => {
  try {
    const sliders = await Slider.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.json({ sliders });
  } catch (err) {
    console.error("listActiveSliders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listAllSliders = async (_req, res) => {
  try {
    const sliders = await Slider.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({ sliders });
  } catch (err) {
    console.error("listAllSliders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateSlider = async (req, res) => {
  try {
    const { id } = req.params;
    const slider = await Slider.findById(id);
    if (!slider) return res.status(404).json({ message: "Slider not found" });

    const { title, subtitle, buttonText, linkUrl, isActive, sortOrder } =
      req.body;

    if (title) slider.title = title;
    if (subtitle !== undefined) slider.subtitle = subtitle;
    if (buttonText !== undefined) slider.buttonText = buttonText;
    if (linkUrl !== undefined) slider.linkUrl = linkUrl;
    if (isActive !== undefined) slider.isActive = !!isActive;
    if (sortOrder !== undefined) slider.sortOrder = Number(sortOrder);

    if (req.file) {
      await cloudinary.uploader.destroy(slider.image.publicId);
      slider.image = { url: req.file.path, publicId: req.file.filename };
    }

    await slider.save();
    res.json({ message: "Slider updated", slider });
  } catch (err) {
    console.error("updateSlider error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteSlider = async (req, res) => {
  try {
    const { id } = req.params;
    const slider = await Slider.findById(id);
    if (!slider) return res.status(404).json({ message: "Slider not found" });

    await cloudinary.uploader.destroy(slider.image.publicId);
    await Slider.deleteOne({ _id: slider._id });

    res.json({ message: "Slider deleted" });
  } catch (err) {
    console.error("deleteSlider error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

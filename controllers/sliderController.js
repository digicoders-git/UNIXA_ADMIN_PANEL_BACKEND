// controllers/sliderController.js
import fs from "fs";
import Slider from "../models/Slider.js";
import { fileToUrl } from "../config/cloudinary.js";

const deleteLocalFile = (p) => { if (p && fs.existsSync(p)) fs.unlinkSync(p); };

export const createSlider = async (req, res) => {
  try {
    const { title, subtitle, buttonText, linkUrl, sortOrder, titleColor, subtitleColor } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });
    
    const sliderData = {
      title,
      subtitle,
      buttonText,
      linkUrl,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      titleColor: titleColor || "#ffffff",
      subtitleColor: subtitleColor || "#ffffff",
    };

    if (req.file) {
      if (req.file.mimetype.startsWith('video/')) {
        sliderData.video = { url: fileToUrl(req.file), publicId: req.file.path };
      } else {
        sliderData.image = { url: fileToUrl(req.file), publicId: req.file.path };
      }
    }

    const slider = await Slider.create(sliderData);
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

    const { title, subtitle, buttonText, linkUrl, isActive, sortOrder, titleColor, subtitleColor } = req.body;

    if (title) slider.title = title;
    if (subtitle !== undefined) slider.subtitle = subtitle;
    if (buttonText !== undefined) slider.buttonText = buttonText;
    if (linkUrl !== undefined) slider.linkUrl = linkUrl;
    if (isActive !== undefined) slider.isActive = !!isActive;
    if (sortOrder !== undefined) slider.sortOrder = Number(sortOrder);
    if (titleColor !== undefined) slider.titleColor = titleColor;
    if (subtitleColor !== undefined) slider.subtitleColor = subtitleColor;

    if (req.file) {
      if (req.file.mimetype.startsWith('video/')) {
        deleteLocalFile(slider.video?.publicId);
        slider.video = { url: fileToUrl(req.file), publicId: req.file.path };
        slider.image = undefined;
      } else {
        deleteLocalFile(slider.image?.publicId);
        slider.image = { url: fileToUrl(req.file), publicId: req.file.path };
        slider.video = undefined;
      }
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

    deleteLocalFile(slider.image?.publicId);
    deleteLocalFile(slider.video?.publicId);
    await Slider.deleteOne({ _id: slider._id });
    res.json({ message: "Slider deleted" });
  } catch (err) {
    console.error("deleteSlider error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

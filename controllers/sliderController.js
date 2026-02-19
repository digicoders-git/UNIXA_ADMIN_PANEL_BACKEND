// controllers/sliderController.js
import Slider from "../models/Slider.js";
import { cloudinary } from "../config/cloudinary.js";

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
        sliderData.video = { url: req.file.path, publicId: req.file.filename };
      } else {
        sliderData.image = { url: req.file.path, publicId: req.file.filename };
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
        if (slider.video?.publicId) {
          await cloudinary.uploader.destroy(slider.video.publicId, { resource_type: 'video' }).catch(err => console.log("Del err:", err));
        }
        slider.video = { url: req.file.path, publicId: req.file.filename };
        slider.image = undefined;
      } else {
        if (slider.image?.publicId) {
          await cloudinary.uploader.destroy(slider.image.publicId).catch(err => console.log("Del err:", err));
        }
        slider.image = { url: req.file.path, publicId: req.file.filename };
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

    if (slider.image?.publicId) {
      await cloudinary.uploader.destroy(slider.image.publicId).catch(err => console.log("Del err:", err));
    }
    if (slider.video?.publicId) {
      await cloudinary.uploader.destroy(slider.video.publicId, { resource_type: 'video' }).catch(err => console.log("Del err:", err));
    }

    await Slider.deleteOne({ _id: slider._id });
    res.json({ message: "Slider deleted" });
  } catch (err) {
    console.error("deleteSlider error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

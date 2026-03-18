// models/Slider.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    url: { type: String },
    publicId: { type: String },
  },
  { _id: false }
);

const sliderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    image: { type: imageSchema },
    video: { type: videoSchema },
    buttonText: { type: String, default: "" },
    linkUrl: { type: String, default: "" },
    titleColor: { type: String, default: "#ffffff" },
    subtitleColor: { type: String, default: "#ffffff" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Slider", sliderSchema);

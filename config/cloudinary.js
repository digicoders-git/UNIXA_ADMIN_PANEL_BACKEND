// config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// ================= ENV CHECK =================
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary env missing");
}

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =====================================================
// ================= PRODUCT IMAGES ====================
// =====================================================

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "glassecommerce_products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});

const productMulter = multer({
  storage: productStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Invalid file type"), false);
  },
});

// 🔥 ORIGINAL multer middleware
const productUpload = productMulter.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
]);

// ✅ CONDITIONAL WRAPPER (THIS IS THE FIX)
const uploadProductImages = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";

  // Agar multipart/form-data hai tabhi multer chalao
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return productUpload(req, res, next);
  }

  // 🔥 JSON request (feature/spec update) → skip multer
  next();
};

// =====================================================
// ================= SLIDER IMAGE ======================
// =====================================================

const sliderStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "glassecommerce_sliders",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});

const sliderMulter = multer({
  storage: sliderStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Invalid file type"), false);
  },
});

const uploadSliderImage = sliderMulter.single("image");

// =====================================================
// ================= CATEGORY IMAGE ====================
// =====================================================

const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "glassecommerce_categories",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
  },
});

const categoryMulter = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Invalid file type"), false);
  },
});

const uploadCategoryImage = categoryMulter.single("image");

// ================= EXPORT =================
export {
  cloudinary,
  uploadProductImages,
  uploadSliderImage,
  uploadCategoryImage,
};

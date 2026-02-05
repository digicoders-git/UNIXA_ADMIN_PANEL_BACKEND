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
    resource_type: "auto", // Automatically detect file type
  },

});

const productMulter = multer({
  storage: productStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Basic check for image types, allow more variants
    const allowedRegex = /image\/(jpeg|jpg|png|webp|gif|avif)/;
    if (allowedRegex.test(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)) {
      return cb(null, true);
    }
    cb(null, true); // Allow and let Cloudinary/frontend handle validation if needed
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
    resource_type: "auto",
  },

});

const sliderMulter = multer({
  storage: sliderStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },

});

const sliderUpload = sliderMulter.single("image");
const uploadSliderImage = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return sliderUpload(req, res, next);
  }
  next();
};


// =====================================================
// ================= CATEGORY IMAGE ====================
// =====================================================

const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "glassecommerce_categories",
    resource_type: "auto",
  },

});

const categoryMulter = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});


const categoryUpload = categoryMulter.single("image");
const uploadCategoryImage = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return categoryUpload(req, res, next);
  }
  next();
};


// =====================================================
// ================= RO PART IMAGE =====================
// =====================================================

const roPartStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "glassecommerce_ro_parts",
    resource_type: "auto",
  },
});

const roPartMulter = multer({
  storage: roPartStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
});

const roPartUpload = roPartMulter.single("mainImage");
const uploadRoPartImage = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return roPartUpload(req, res, next);
  }
  next();
};

// ================= EXPORT =================
export {
  cloudinary,
  uploadProductImages,
  uploadSliderImage,
  uploadCategoryImage,
  uploadRoPartImage,
};

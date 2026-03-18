// config/upload.js (renamed logically but kept as cloudinary.js for import compatibility)
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

// Ensure folder exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Generic local storage factory
const makeStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_ROOT, folder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, name);
    },
  });

const imageFilter = (req, file, cb) => cb(null, true);

const fileSizeLimit = (mb) => mb * 1024 * 1024;

const makeMulter = (folder, limits, fields) => {
  const m = multer({ storage: makeStorage(folder), limits, fileFilter: imageFilter });
  return fields ? m.fields(fields) : m.single("image");
};

const wrapMiddleware = (upload) => (req, res, next) => upload(req, res, next);

// Helper: convert local file path to public URL
export const fileToUrl = (file) => {
  if (!file?.path) return null;
  const normalized = file.path.replace(/\\/g, "/");
  const idx = normalized.indexOf("uploads/");
  if (idx === -1) return null;
  return "/" + normalized.slice(idx);
};

// =====================================================
// ================= PRODUCT IMAGES ====================
// =====================================================
const productUpload = makeMulter(
  "products",
  { fileSize: fileSizeLimit(10) },
  [{ name: "mainImage", maxCount: 1 }, { name: "galleryImages", maxCount: 10 }]
);
export const uploadProductImages = wrapMiddleware(productUpload);

// =====================================================
// ================= SLIDER IMAGE ======================
// =====================================================
const sliderUpload = makeMulter("sliders", { fileSize: fileSizeLimit(100) });
export const uploadSliderImage = wrapMiddleware(sliderUpload);

// =====================================================
// ================= CATEGORY IMAGE ====================
// =====================================================
const categoryUpload = makeMulter("categories", { fileSize: fileSizeLimit(5) });
export const uploadCategoryImage = wrapMiddleware(categoryUpload);

// =====================================================
// ================= RO PART IMAGE =====================
// =====================================================
const roPartM = multer({
  storage: makeStorage("ro-parts"),
  limits: { fileSize: fileSizeLimit(5) },
  fileFilter: imageFilter,
}).single("mainImage");
export const uploadRoPartImage = wrapMiddleware(roPartM);

// =====================================================
// ================= RENTAL PLAN IMAGE =================
// =====================================================
const rentalPlanUpload = makeMulter("rental-plans", { fileSize: fileSizeLimit(5) });
export const uploadRentalPlanImage = wrapMiddleware(rentalPlanUpload);

// =====================================================
// ================= BLOG IMAGES =======================
// =====================================================
const blogUpload = makeMulter(
  "blogs",
  { fileSize: fileSizeLimit(10) },
  [{ name: "thumbnailImage", maxCount: 1 }, { name: "coverImage", maxCount: 1 }]
);
export const uploadBlogImages = wrapMiddleware(blogUpload);

// =====================================================
// ================= PROFILE PICTURES ==================
// =====================================================
const profileM = multer({
  storage: makeStorage("profiles"),
  limits: { fileSize: fileSizeLimit(5) },
  fileFilter: imageFilter,
}).single("profilePicture");
export const uploadProfilePicture = wrapMiddleware(profileM);

// Dummy cloudinary export (kept for legacy imports)
export const cloudinary = null;

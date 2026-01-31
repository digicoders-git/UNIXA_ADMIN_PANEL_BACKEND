// controllers/productController.js
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Review from "../models/Review.js";
import { cloudinary } from "../config/cloudinary.js";

/* ================= UTIL ================= */

const parseMaybeJSON = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    if (typeof value === "string") {
      return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return fallback;
  }
};

/* ================= CREATE ================= */

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      discountPercent,
      sizes,
      colors,
      addOns,
      description,
      about,
      categoryId,
      specifications,
      features,
      offerId,
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

    if (!req.files?.mainImage?.[0]) {
      return res.status(400).json({ message: "mainImage is required" });
    }

    const mainImageFile = req.files.mainImage[0];
    const galleryFiles = req.files.galleryImages || [];

    const product = await Product.create({
      name,
      category: category._id,
      price: Number(price),
      discountPercent: Number(discountPercent || 0),
      mainImage: {
        url: mainImageFile.path,
        publicId: mainImageFile.filename,
      },
      galleryImages: galleryFiles.map((file) => ({
        url: file.path,
        publicId: file.filename,
      })),
      sizes: parseMaybeJSON(sizes, []),
      colors: parseMaybeJSON(colors, []),
      addOns: parseMaybeJSON(addOns, []),
      description,
      about,
      specifications: parseMaybeJSON(specifications, {}),
      features: parseMaybeJSON(features, []),
      offer: offerId || null,
      isActive: isActive === "false" ? false : true,
    });

    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    console.error("createProduct error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= LIST ================= */

export const listProducts = async (_req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "productId",
          as: "reviewData",
        },
      },
      {
        $addFields: {
          averageRating: {
            $ifNull: [{ $round: [{ $avg: "$reviewData.rating" }, 1] }, 0],
          },
          totalReviews: { $size: "$reviewData" },
        },
      },
      { $project: { reviewData: 0 } },
      { $sort: { createdAt: -1 } },
    ]);

    res.json({ products });
  } catch (err) {
    console.error("listProducts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ONE ================= */

export const getProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const product =
      (await Product.findOne({ slug: idOrSlug })
        .populate("category", "name slug")
        .populate("offer")) ||
      (await Product.findById(idOrSlug)
        .populate("category", "name slug")
        .populate("offer"));

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviews = await Review.find({ productId: product._id });
    const totalReviews = reviews.length;
    const avg =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    res.json({
      product: {
        ...product.toObject(),
        averageRating: Number(avg.toFixed(1)),
        totalReviews,
      },
    });
  } catch (err) {
    console.error("getProduct error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE ================= */

export const updateProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const product =
      (await Product.findOne({ slug: idOrSlug })) ||
      (await Product.findById(idOrSlug));

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      name,
      price,
      discountPercent,
      sizes,
      colors,
      addOns,
      description,
      about,
      categoryId,
      isActive,
      specifications,
      features,
      offerId,
    } = req.body;

    // 🔥 SAFE UPDATES (JSON OR FORM DATA)

    if (name) product.name = name;
    if (price !== undefined) product.price = Number(price);
    if (discountPercent !== undefined)
      product.discountPercent = Number(discountPercent);

    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (!category)
        return res.status(400).json({ message: "Invalid categoryId" });
      product.category = category._id;
    }

    if (sizes !== undefined)
      product.sizes = parseMaybeJSON(sizes, product.sizes);
    if (colors !== undefined)
      product.colors = parseMaybeJSON(colors, product.colors);
    if (addOns !== undefined)
      product.addOns = parseMaybeJSON(addOns, product.addOns);

    if (description !== undefined) product.description = description;
    if (about !== undefined) product.about = about;

    if (isActive !== undefined)
      product.isActive = isActive === true || isActive === "true";

    if (specifications !== undefined)
      product.specifications = parseMaybeJSON(
        specifications,
        product.specifications
      );

    if (features !== undefined)
      product.features = parseMaybeJSON(features, product.features);

    if (offerId !== undefined) product.offer = offerId || null;

    /* ===== IMAGE UPDATE ===== */

    if (req.files?.mainImage?.[0]) {
      await cloudinary.uploader.destroy(product.mainImage.publicId);
      const file = req.files.mainImage[0];
      product.mainImage = { url: file.path, publicId: file.filename };
    }

    if (req.files?.galleryImages?.length) {
      for (const img of product.galleryImages) {
        await cloudinary.uploader.destroy(img.publicId);
      }
      product.galleryImages = req.files.galleryImages.map((file) => ({
        url: file.path,
        publicId: file.filename,
      }));
    }

    await product.save();
    res.json({ message: "Product updated", product });
  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DELETE ================= */

export const deleteProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const product =
      (await Product.findOne({ slug: idOrSlug })) ||
      (await Product.findById(idOrSlug));

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await cloudinary.uploader.destroy(product.mainImage.publicId);
    for (const img of product.galleryImages) {
      await cloudinary.uploader.destroy(img.publicId);
    }

    await Product.deleteOne({ _id: product._id });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("deleteProduct error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

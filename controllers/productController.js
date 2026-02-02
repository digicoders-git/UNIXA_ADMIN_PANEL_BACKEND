// controllers/productController.js
import mongoose from "mongoose";
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
    // Return the string as-is if it's not JSON, or try fallback
    return typeof value === "string" && value.length > 0 ? value : fallback;
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
    res.status(500).json({
      message: `Server error: ${err.message}`,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
};

/* ================= LIST ================= */

export const listProducts = async (req, res) => {
  try {
    const { all } = req.query;
    const match = all === "true" ? {} : { isActive: true };
    const products = await Product.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $unwind: {
          path: "$categoryData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          category: "$categoryData",
        },
      },
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
      { $project: { reviewData: 0, categoryData: 0 } },
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

    let product = await Product.findOne({ slug: idOrSlug })
      .populate("category", "name slug")
      .populate("offer");

    if (!product && mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug)
        .populate("category", "name slug")
        .populate("offer");
    }

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

    let product = await Product.findOne({ slug: idOrSlug });

    if (!product && mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug);
    }

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
      if (product.mainImage?.publicId) {
        await cloudinary.uploader.destroy(product.mainImage.publicId).catch(err => console.log("Cloudinary destroy error:", err));
      }
      const file = req.files.mainImage[0];
      product.mainImage = { url: file.path, publicId: file.filename };
    }

    if (req.files?.galleryImages?.length) {
      if (product.galleryImages?.length) {
        for (const img of product.galleryImages) {
          if (img.publicId) {
            await cloudinary.uploader.destroy(img.publicId).catch(err => console.log("Cloudinary destroy error:", err));
          }
        }
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
    res.status(500).json({ 
      message: `Internal server error: ${err.message}`, 
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined 
    });

  }
};


/* ================= DELETE ================= */

export const deleteProduct = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let product = await Product.findOne({ slug: idOrSlug });
    if (!product && mongoose.Types.ObjectId.isValid(idOrSlug)) {
      product = await Product.findById(idOrSlug);
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.mainImage?.publicId) {
      await cloudinary.uploader.destroy(product.mainImage.publicId).catch(err => console.log("Del error:", err));
    }
    if (product.galleryImages?.length) {
      for (const img of product.galleryImages) {
        if (img.publicId) {
          await cloudinary.uploader.destroy(img.publicId).catch(err => console.log("Del error:", err));
        }
      }
    }

    await Product.deleteOne({ _id: product._id });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("deleteProduct error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// routes/blogRoutes.js
import express from "express";
import {
  // Admin functions
  createBlog,
  getAllBlogs,
  updateBlog,
  deleteBlog,
  
  // Public functions
  getPublishedBlogs,
  getBlog,
  getFeaturedBlogs,
  getBlogCategories,
  likeBlog
} from "../controllers/blogController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// PUBLIC ROUTES
router.get("/", getPublishedBlogs); // Get published blogs with pagination
router.get("/featured", getFeaturedBlogs); // Get featured blogs
router.get("/categories", getBlogCategories); // Get all categories
router.get("/:idOrSlug", getBlog); // Get single blog by ID or slug
router.post("/:idOrSlug/like", likeBlog); // Like a blog

// ADMIN ROUTES (Protected)
router.post("/admin", requireAuth, createBlog); // Create blog
router.get("/admin/all", requireAuth, getAllBlogs); // Get all blogs (admin)
router.put("/admin/:idOrSlug", requireAuth, updateBlog); // Update blog
router.delete("/admin/:idOrSlug", requireAuth, deleteBlog); // Delete blog

export default router;
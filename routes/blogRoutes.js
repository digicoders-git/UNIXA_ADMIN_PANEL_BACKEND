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
  likeBlog,
  unlikeBlog,
  addComment,
  getComments,
  deleteComment
} from "../controllers/blogController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadBlogImages } from "../config/cloudinary.js";

const router = express.Router();

// ADMIN ROUTES (Protected) - These should come FIRST
router.post("/admin", requireAuth, uploadBlogImages, createBlog); // Create blog
router.get("/admin/all", requireAuth, getAllBlogs); // Get all blogs (admin)
router.put("/admin/:idOrSlug", requireAuth, uploadBlogImages, updateBlog); // Update blog
router.delete("/admin/:idOrSlug", requireAuth, deleteBlog); // Delete blog

// PUBLIC ROUTES - These should come AFTER admin routes
router.get("/featured", getFeaturedBlogs); // Get featured blogs
router.get("/categories", getBlogCategories); // Get all categories
router.post("/:idOrSlug/like", likeBlog); // Like a blog
router.post("/:idOrSlug/unlike", unlikeBlog); // Unlike a blog
router.post("/:idOrSlug/comments", addComment); // Add comment
router.get("/:idOrSlug/comments", getComments); // Get comments
router.delete("/comments/:commentId", deleteComment); // Delete comment
router.get("/", getPublishedBlogs); // Get published blogs with pagination
router.get("/:idOrSlug", getBlog); // Get single blog by ID or slug

export default router;
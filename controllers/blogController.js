// controllers/blogController.js
import Blog from "../models/Blog.js";
import Admin from "../models/Admin.js";
import BlogComment from "../models/BlogComment.js";

// ADMIN FUNCTIONS

// Create Blog (Admin)
export const createBlog = async (req, res) => {
  try {
    const {
      title,
      shortDescription,
      content, // TinyMCE HTML content
      thumbnailImage,
      coverImage,
      category,
      tags,
      metaTitle,
      metaDescription,
      metaKeywords,
      isPublished,
      isFeatured
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    // Get admin info from token
    const adminIdFromToken = req.user.sub; // This is the _id
    const adminUsername = req.user.adminId; // This is the username

    let admin = await Admin.findById(adminIdFromToken);
    
    // Fallback: If not found, try finding by adminId (string field)
    if (!admin) {
      admin = await Admin.findOne({ adminId: adminUsername });
    }

    // Handle uploaded images
    let finalThumbnail = thumbnailImage;
    let finalCover = coverImage;

    if (req.files) {
      if (req.files.thumbnailImage && req.files.thumbnailImage[0]) {
        finalThumbnail = req.files.thumbnailImage[0].path;
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        finalCover = req.files.coverImage[0].path;
      }
    }

    const blog = await Blog.create({
      title,
      shortDescription,
      content,
      thumbnailImage: finalThumbnail,
      coverImage: finalCover,
      category,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(",").map(t => t.trim()) : []),
      authorName: admin ? admin.name : (adminUsername || "Admin"),
      authorId: admin ? admin._id : adminIdFromToken,
      metaTitle: metaTitle || title,
      metaDescription,
      metaKeywords: Array.isArray(metaKeywords) ? metaKeywords : (metaKeywords ? metaKeywords.split(",").map(k => k.trim()) : []),
      isPublished: !!isPublished,
      isFeatured: !!isFeatured
    });

    res.status(201).json({ message: "Blog created successfully", blog });
  } catch (err) {
    console.error("createBlog error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get All Blogs (Admin)
export const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    
    const filter = {};
    if (status === "published") filter.isPublished = true;
    if (status === "draft") filter.isPublished = false;
    if (category) filter.category = category;

    const blogs = await Blog.find(filter)
      .populate("authorId", "name adminId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Blog.countDocuments(filter);

    res.json({
      blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("getAllBlogs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Blog (Admin)
export const updateBlog = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const updates = req.body;

    let blog = await Blog.findOne({
      $or: [{ _id: idOrSlug }, { slug: idOrSlug }]
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Handle uploaded images
    if (req.files) {
      if (req.files.thumbnailImage && req.files.thumbnailImage[0]) {
        updates.thumbnailImage = req.files.thumbnailImage[0].path;
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        updates.coverImage = req.files.coverImage[0].path;
      }
    }

    // Handle tags and keywords
    if (updates.tags && !Array.isArray(updates.tags)) {
      updates.tags = updates.tags.split(",").map(t => t.trim());
    }
    if (updates.metaKeywords && !Array.isArray(updates.metaKeywords)) {
      updates.metaKeywords = updates.metaKeywords.split(",").map(k => k.trim());
    }

    Object.assign(blog, updates);
    await blog.save();

    res.json({ message: "Blog updated successfully", blog });
  } catch (err) {
    console.error("updateBlog error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Blog (Admin)
export const deleteBlog = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const blog = await Blog.findOneAndDelete({
      $or: [{ _id: idOrSlug }, { slug: idOrSlug }]
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error("deleteBlog error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUBLIC FUNCTIONS

// Get Published Blogs (Public)
export const getPublishedBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, tag, search } = req.query;
    
    const filter = { isPublished: true };
    
    if (category) filter.category = category;
    if (tag) filter.tags = { $in: [tag] };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } }
      ];
    }

    const blogs = await Blog.find(filter, {
      title: 1,
      slug: 1,
      shortDescription: 1,
      thumbnailImage: 1,
      category: 1,
      tags: 1,
      authorName: 1,
      views: 1,
      likes: 1,
      readTime: 1,
      publishedAt: 1,
      isFeatured: 1
    })
    .sort({ isFeatured: -1, publishedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Blog.countDocuments(filter);

    res.json({
      blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("getPublishedBlogs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Single Blog (Public)
export const getBlog = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    // Check if it's a valid ObjectId
    let query;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid ObjectId
      query = { _id: idOrSlug, isPublished: true };
    } else {
      // Treat as slug
      query = { slug: idOrSlug, isPublished: true };
    }

    const blog = await Blog.findOne(query).populate("authorId", "name");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found or not published" });
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    res.json({ blog });
  } catch (err) {
    console.error("getBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get Featured Blogs (Public)
export const getFeaturedBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find(
      { isPublished: true, isFeatured: true },
      {
        title: 1,
        slug: 1,
        shortDescription: 1,
        thumbnailImage: 1,
        category: 1,
        authorName: 1,
        readTime: 1,
        publishedAt: 1
      }
    )
    .sort({ publishedAt: -1 })
    .limit(5);

    res.json({ blogs });
  } catch (err) {
    console.error("getFeaturedBlogs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Blog Categories (Public)
export const getBlogCategories = async (req, res) => {
  try {
    const categories = await Blog.distinct("category", { isPublished: true });
    res.json({ categories: categories.filter(Boolean) });
  } catch (err) {
    console.error("getBlogCategories error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Like Blog (Public)
export const likeBlog = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    // Check if it's a valid ObjectId
    let blog;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findOne({ _id: idOrSlug, isPublished: true });
    } else {
      blog = await Blog.findOne({ slug: idOrSlug, isPublished: true });
    }

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.likes += 1;
    await blog.save();

    res.json({ message: "Blog liked", likes: blog.likes });
  } catch (err) {
    console.error("likeBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Unlike Blog (Public)
export const unlikeBlog = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    // Check if it's a valid ObjectId
    let blog;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findOne({ _id: idOrSlug, isPublished: true });
    } else {
      blog = await Blog.findOne({ slug: idOrSlug, isPublished: true });
    }

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.likes = Math.max(0, blog.likes - 1);
    await blog.save();

    res.json({ message: "Blog unliked", likes: blog.likes });
  } catch (err) {
    console.error("unlikeBlog error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Add Comment (Public)
export const addComment = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const { name, email, comment } = req.body;

    if (!name || !email || !comment) {
      return res.status(400).json({ message: "Name, email, and comment are required" });
    }

    // Check if it's a valid ObjectId
    let blog;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findOne({ _id: idOrSlug, isPublished: true });
    } else {
      blog = await Blog.findOne({ slug: idOrSlug, isPublished: true });
    }

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const newComment = await BlogComment.create({
      blogId: blog._id,
      name: name.trim(),
      email: email.trim(),
      comment: comment.trim(),
      isApproved: true, // Auto-approve
      userId: req.user?.sub
    });

    res.status(201).json({ message: "Comment posted successfully", comment: newComment });
  } catch (err) {
    console.error("addComment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get Comments (Public)
export const getComments = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    // Check if it's a valid ObjectId
    let blog;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      blog = await Blog.findOne({ _id: idOrSlug, isPublished: true });
    } else {
      blog = await Blog.findOne({ slug: idOrSlug, isPublished: true });
    }

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const comments = await BlogComment.find({
      blogId: blog._id
    }).sort({ createdAt: -1 });

    res.json({ comments });
  } catch (err) {
    console.error("getComments error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete Comment (Public)
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email } = req.body;

    const comment = await BlogComment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Verify email matches
    if (comment.email !== email) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await BlogComment.findByIdAndDelete(commentId);
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
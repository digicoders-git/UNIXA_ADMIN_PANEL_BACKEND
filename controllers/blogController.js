// controllers/blogController.js
import Blog from "../models/Blog.js";
import Admin from "../models/Admin.js";

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

    const blog = await Blog.create({
      title,
      shortDescription,
      content,
      thumbnailImage,
      coverImage,
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

    const blog = await Blog.findOne({
      $or: [{ _id: idOrSlug }, { slug: idOrSlug }],
      isPublished: true
    }).populate("authorId", "name");

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Increment views
    blog.views += 1;
    await blog.save();

    res.json({ blog });
  } catch (err) {
    console.error("getBlog error:", err);
    res.status(500).json({ message: "Server error" });
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

    const blog = await Blog.findOne({
      $or: [{ _id: idOrSlug }, { slug: idOrSlug }],
      isPublished: true
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.likes += 1;
    await blog.save();

    res.json({ message: "Blog liked", likes: blog.likes });
  } catch (err) {
    console.error("likeBlog error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
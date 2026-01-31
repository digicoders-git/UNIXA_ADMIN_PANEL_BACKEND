// models/Blog.js
import mongoose from "mongoose";

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true },
  shortDescription: { type: String, maxlength: 300 },
  content: { type: String, required: true }, // TinyMCE HTML content

  thumbnailImage: { type: String }, // For blog listing
  coverImage: { type: String }, // For blog detail page

  category: { type: String, default: "General" },
  tags: [{ type: String, trim: true }],

  authorName: { type: String, required: true },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin", // Admin writes blogs
    required: true
  },

  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  readTime: { type: String }, // e.g., "5 min read"

  // SEO fields
  metaTitle: { type: String },
  metaDescription: { type: String, maxlength: 160 },
  metaKeywords: [{ type: String }],

  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  
  // Featured blog
  isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

// Auto-generate slug from title
blogSchema.pre("save", function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + "-" + Date.now();
  }
  
  // Auto-calculate read time (rough estimate)
  if (this.content && !this.readTime) {
    const wordsPerMinute = 200;
    const wordCount = this.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    this.readTime = `${minutes} min read`;
  }
  
  // Set published date when publishing
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

export default mongoose.model("Blog", blogSchema);
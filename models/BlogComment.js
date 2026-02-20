import mongoose from "mongoose";

const blogCommentSchema = new mongoose.Schema({
  blogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Blog",
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  comment: { type: String, required: true },
  isApproved: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("BlogComment", blogCommentSchema);

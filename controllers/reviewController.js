import Review from "../models/Review.js";
import Product from "../models/Product.js";

// Add a new review/testimonial
export const addReview = async (req, res) => {
  try {
    const { productId, user, role, rating, comment, isTestimonial } = req.body;

    if (!user || !rating || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const review = new Review({
      productId,
      user,
      role: role || "Customer",
      rating,
      comment,
      isTestimonial: isTestimonial !== undefined ? isTestimonial : true,
      isApproved: false,
    });

    await review.save();

    res.status(201).json({ success: true, message: "Review submitted for approval", review });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    // Fetch reviews
    
    // Calculate average rating
    const reviews = await Review.find({ productId, isApproved: true }).sort({ createdAt: -1 });
    const totalReviews = reviews.length;
    let averageRating = 0;

    if (totalReviews > 0) {
      const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
      averageRating = (sum / totalReviews).toFixed(1);
    }

    res.status(200).json({ 
      success: true, 
      reviews, 
      averageRating: parseFloat(averageRating), 
      totalReviews 
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get all reviews (for testimonials)
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true, isTestimonial: true }).sort({ createdAt: -1 });
    res.status(200).json({ 
      success: true, 
      reviews 
    });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get slider reviews
export const getSliderReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true, showInSlider: true }).sort({ createdAt: -1 });
    res.status(200).json({ 
      success: true, 
      reviews 
    });
  } catch (error) {
    console.error("Error fetching slider reviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Admin: Get all reviews (pending + approved)
export const getAdminReviews = async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Approve review
export const approveReview = async (req, res) => {
  try {
    const { showInSlider } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id, 
      { 
        isApproved: true,
        showInSlider: showInSlider || false 
      }, 
      { new: true }
    );
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete review
export const deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

import Review from "../models/Review.js";
import Product from "../models/Product.js";

// Add a new review
export const addReview = async (req, res) => {
  try {
    const { productId, user, rating, comment } = req.body;

    if (!productId || !user || !rating) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const review = new Review({
      productId,
      user,
      rating,
      comment,
    });

    await review.save();

    res.status(201).json({ success: true, message: "Review added successfully", review });
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
    const reviews = await Review.find({ isApproved: true }).sort({ createdAt: -1 });
    res.status(200).json({ 
      success: true, 
      reviews 
    });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

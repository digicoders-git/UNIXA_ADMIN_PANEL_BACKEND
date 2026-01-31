// middleware/userAuth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Access token required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ 
      _id: decoded.sub, 
      email: decoded.email,
      isActive: true 
    }).select("+tokenVersion");

    if (!user) {
      return res.status(401).json({ message: "Invalid token or user not found" });
    }

    // Check token version for logout-all functionality
    if (decoded.tv !== user.tokenVersion) {
      return res.status(401).json({ message: "Token expired, please login again" });
    }

    req.user = { 
      sub: user._id.toString(), 
      email: user.email, 
      name: user.name 
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
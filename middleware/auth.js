import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    
    if (!token) {
      console.log("Auth Fail: Missing Token on", req.originalUrl);
      return res.status(401).json({ message: "Missing auth token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("CRITICAL: JWT_SECRET is missing from environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }
    const payload = jwt.verify(token, secret);
    req.user = payload; // { sub, email, tv }
    next();
  } catch (err) {
    console.error("Auth Fail:", err.message, "on", req.originalUrl);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

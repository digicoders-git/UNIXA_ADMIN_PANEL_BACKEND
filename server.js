// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import moment from "moment-timezone";

import adminRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import sliderRoutes from "./routes/sliderRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
// import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

// User routes
import userRoutes from "./routes/userRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import userOrderRoutes from "./routes/userOrderRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";

const app = express();

app.use(helmet());
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
  "http://localhost:5173",
  "http://localhost:3000",
  "https://Unixa-kappa.vercel.app"
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// CORS preflight is already handled by the app.use(cors(...)) middleware above.

app.use(morgan("dev"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use("/api/admin/login", authLimiter);
app.use("/api/user/login", authLimiter);
app.use("/api/users/login", authLimiter);
app.use("/api/users/register", authLimiter);

// 🟢 DB Connect (with India timezone logging)
await connectDB();
console.log("⏳ Timezone:", moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A"));

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/sliders", sliderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/reviews", reviewRoutes);
// app.use("/api/payment", paymentRoutes);

// User routes
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/user-orders", userOrderRoutes); 
app.use("/api/transactions", transactionRoutes); 

// Default
app.get("/", (_req, res) => res.send("✅ API is running..."));

// Health check time in IST
app.get("/health", (_req, res) =>
  res.json({
    status: "OK",
    timeIST: moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A"),
  })
);

// 404 Handler
app.use((req, res) =>
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
);

// Error Handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on :${PORT}`));

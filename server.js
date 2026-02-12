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
import amcPlanRoutes from "./routes/amcPlanRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import sliderRoutes from "./routes/sliderRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import employeeAssetRoutes from "./routes/employeeAssetRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import refundRoutes from "./routes/refundRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import roPartRoutes from "./routes/roPartRoutes.js";

import userRoutes from "./routes/userRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import userOrderRoutes from "./routes/userOrderRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import amcRoutes from "./routes/amcRoutes.js";
import rentalPlanRoutes from "./routes/rentalPlanRoutes.js";
import userDashboardRoutes from "./routes/userDashboardRoutes.js";
import userRentalRoutes from "./routes/userRentalRoutes.js";
import userServiceRequestRoutes from "./routes/userServiceRequestRoutes.js";
import userAmcRoutes from "./routes/userAmcRoutes.js";

const app = express();

app.use(helmet());
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5180",
  "https://Unixa-kappa.vercel.app",
  "https://unixa-admin-panel.vercel.app",
  "https://unixa-website.vercel.app",
  "https://unixa-user-panel.vercel.app"

].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*");
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // Instead of throwing an Error that leads to 500, we just return false
      // for CORS check which results in a standard CORS error in the browser
      callback(null, false);
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

// 🟢 DB Connection will be initialized in the server listen block below to prevent Render deployment timeouts


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
app.use("/api/payment", paymentRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/employee-assets", employeeAssetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/ro-parts", roPartRoutes);

// User routes
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/amc-plans", amcPlanRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/user-orders", userOrderRoutes); 
app.use("/api/transactions", transactionRoutes); 
app.use("/api/amc-user", amcRoutes);
app.use("/api/rental-plans", rentalPlanRoutes);
app.use("/api/user-dashboard", userDashboardRoutes);
app.use("/api/user-rentals", userRentalRoutes);
app.use("/api/service-requests", userServiceRequestRoutes);
app.use("/api/my-amcs", userAmcRoutes);



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
  res.status(500).json({ 
    message: err.message || "Internal server error",
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});


// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  
  // 🟢 Connect to Database after port binding
  try {
    await connectDB();
    console.log("⏳ Timezone:", moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A"));
  } catch (error) {
    console.error("Startup Database Connection Failed:", error);
  }
});

// Trigger restart for amc-plans

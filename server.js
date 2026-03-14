// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import moment from "moment-timezone";
import cron from "node-cron";
import UserAmc from "./models/UserAmc.js";
import AssignedTicket from "./models/AssignedTicket.js";
import Employee from "./models/Employee.js";

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
import smsRoutes from "./routes/smsRoutes.js";
import refundRoutes from "./routes/refundRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import roPartRoutes from "./routes/roPartRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";

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
import adminServiceRequestRoutes from "./routes/adminServiceRequestRoutes.js";
import userAmcRoutes from "./routes/userAmcRoutes.js";
import employeeDashboardRoutes from "./routes/employeeDashboardRoutes.js";
import managerDashboardRoutes from "./routes/managerDashboardRoutes.js";
import assignedTicketRoutes from "./routes/assignedTicketRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import amcJobsRoutes from "./routes/amcJobsRoutes.js";

const app = express();

app.use(helmet());
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5180",
  "https://Unixa-kappa.vercel.app",
  "https://unixa-admin-panel.vercel.app",
  "https://unixa-website.vercel.app",
  "https://unixa-user-panel.vercel.app",
  "https://unixa-manager-panel.vercel.app",
  "https://unixa-employee-panel.vercel.app",
  "https://admin.unixa.co.in",
  "https://www.admin.unixa.co.in",
  "https://user.unixa.co.in",
  "https://www.user.unixa.co.in",
  "https://unixa.co.in",
  "https://www.unixa.co.in",
  "https://manager.unixa.co.in",
  "https://admin.unixa.co.in",
  "https://manager.unixa.co.in",
  "https://employee.unixa.co.in",
  "https://user.unixa.co.in",
  "https://www.unixa.co.in"
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

// app.use(cors())
// Logging disabled to keep console clean
// app.use(morgan("dev"));

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
app.use("/api/sms", smsRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/ro-parts", roPartRoutes);
app.use("/api/certificates", certificateRoutes);

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
app.use("/api/admin/service-requests", adminServiceRequestRoutes);
app.use("/api/my-amcs", userAmcRoutes);
app.use("/api/employee-dashboard", employeeDashboardRoutes);
app.use("/api/manager-dashboard", managerDashboardRoutes);
app.use("/api/assigned-tickets", assignedTicketRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/amc-jobs", amcJobsRoutes);




app.get("/", (_req, res) => res.send("✅ API is running..."));

// Health check time in IST
app.get("/health", (_req, res) =>
  res.json({
    status: "OK",
    timeIST: moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A"),
  })
);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error Handler
app.use((err, req, res, next) => {
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

    // 🔄 Schedule AMC status update job - runs every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await UserAmc.updateExpiredAmcs();
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated ${result.modifiedCount} expired AMCs at ${moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A")}`);
        }
      } catch (error) {
        console.error('❌ AMC status update job failed:', error);
      }
    });

    // 🔄 Schedule 4-month AMC reminder job - runs every day at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        const today = new Date();
        const fourMonthsLater = new Date();
        fourMonthsLater.setMonth(fourMonthsLater.getMonth() + 4);

        // Find AMCs that need reminder (4 months away from expiry, not yet reminded)
        const amcsToRemind = await UserAmc.find({
          status: 'Active',
          reminderSent: false,
          endDate: {
            $gte: today,
            $lte: fourMonthsLater
          }
        }).populate('userId', 'firstName lastName email phone');

        if (amcsToRemind.length > 0) {
          // Get active employees
          const employees = await Employee.find({ status: true }).select('name email');

          if (employees.length === 0) {
            console.warn('⚠️ No active employees found for AMC reminder assignment');
            return;
          }

          for (const amc of amcsToRemind) {
            // Assign to random employee
            const randomEmployee = employees[Math.floor(Math.random() * employees.length)];

            // Calculate reminder number
            const reminderNumber = amc.reminderHistory ? amc.reminderHistory.length + 1 : 1;

            // Create ticket
            const ticket = await AssignedTicket.create({
              ticketType: 'service_request',
              title: `AMC Renewal - ${amc.productName} (${amc.amcPlanName})`,
              description: `Field visit required for AMC renewal. AMC expires on ${moment(amc.endDate).tz("Asia/Kolkata").format("DD-MM-YYYY")}`,
              assignedBy: 'System',
              assignedTo: randomEmployee.name,
              priority: 'High',
              status: 'Pending',
              userId: amc.userId._id,
              amcId: amc._id,
              customerName: amc.userId.firstName + ' ' + amc.userId.lastName,
              customerPhone: amc.userId.phone,
              customerEmail: amc.userId.email,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              visitType: 'AMC_REMINDER',
              assignedByRole: 'Admin'
            });

            // Add to reminder history
            amc.reminderHistory.push({
              reminderNumber,
              reminderDate: new Date(),
              ticketId: ticket._id,
              assignedTo: randomEmployee.name,
              assignedByRole: 'Admin',
              status: 'Pending'
            });

            // Mark reminder as sent
            amc.reminderSent = true;
            await amc.save();

            console.log(`✅ AMC reminder #${reminderNumber} ticket created for ${amc.productName}, assigned to ${randomEmployee.name}`);
          }

          console.log(`✅ Created ${amcsToRemind.length} AMC reminder tickets at ${moment().tz("Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A")}`);
        }
      } catch (error) {
        console.error('❌ AMC reminder job failed:', error);
      }
    });

    console.log('🕐 AMC status update job scheduled (runs every hour)');
    console.log('🕐 AMC 4-month reminder job scheduled (runs daily at midnight)');
  } catch (error) {
    console.error("Startup Database Connection Failed:", error);
  }
});

// Trigger restart for amc-plans
// Trigger restart for lead enum update

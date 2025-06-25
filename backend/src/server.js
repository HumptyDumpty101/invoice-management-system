const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use(limiter);

// body Parsing Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Static file serving
app.use("/uploads", express.static("uploads"));

// Routes
// TODO:
// app.use('/api/upload', require('./routes/upload'));
// app.use('/api/invoices', require('./routes/invoices'));
// app.use('/api/categories', require('./routes/categories'));
// app.use('/api/dashboard', require('./routes/dashboard'));

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.log(`Error: ${err.stack}`);

  // Validation Errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: err.message,
    });
  }

  // Multer Error
  if (err.name === "MulterError") {
    return res.status(400).json({
      error: "File Upload Error",
      details: err.message,
    });
  }

  // Unhandled Errors
  return res.status(500).json({
    error: "Internal Server Error",
    details: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route Not Found",
    details: "",
  });
});

// DB Connection
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => {
    console.log("Connected to MongoDB");

    // Start Server
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(`MongoDB Connection Error : ${err}`);
    process.exit(1);
  });

//   Graceful Shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
});

module.exports = app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { verifyResendWebhook } = require("./src/middleware/webhookAuth");
const cron = require("node-cron");
const conversationService = require("./src/services/conversationService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// API Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/dashboard", require("./src/routes/dashboard"));
app.use("/api/properties", require("./src/routes/properties"));
app.use("/api/tenants", require("./src/routes/tenants"));
app.use("/api/maintenance-requests", require("./src/routes/maintenance"));
app.use("/api/conversations", require("./src/routes/conversations"));
app.use("/api/messages", require("./src/routes/messages"));
app.use("/api/threads", require("./src/routes/threads"));
app.use("/api/user", require("./src/middleware/auth"), require("./src/routes/user"));
app.use("/api/settings", require("./src/middleware/auth"), require("./src/routes/settings"));

// Webhook Routes (no authentication required)
// Apply webhook signature verification to email inbound endpoint
app.use("/webhooks/email/inbound", verifyResendWebhook);
app.use("/webhooks", require("./src/routes/webhooks"));

// Basic route for testing
app.get("/", (req, res) => {
  res.json({
    message: "AI Property Management System API",
    status: "running",
    version: "1.0.0",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Schedule auto-closure task to run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduled Task] Running inactive thread closure check');
    try {
      await conversationService.closeInactiveThreads();
    } catch (error) {
      console.error('[Scheduled Task] Auto-closure failed:', error);
    }
  });

  console.log('[Scheduled Task] Auto-closure check scheduled to run every hour');
});

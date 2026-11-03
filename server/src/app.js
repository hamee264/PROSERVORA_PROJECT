const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const providerRoutes = require("./routes/providerRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const paymentWebhookRoutes = require("./routes/paymentWebhookRoutes");
const bankAccountRoutes = require("./routes/bankAccountRoutes");
const payoutRoutes = require("./routes/payoutRoutes");
const payoutWebhookRoutes = require("./routes/payoutWebhookRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const disputeRoutes = require("./routes/disputeRoutes");

const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorMiddleware");

const app = express();

// ============================================================
// CORS
// ============================================================

// Supports multiple frontend origins separated by commas.
//
// Example .env:
// CLIENT_URL=http://localhost:5173,http://localhost:5174
//
// If CLIENT_URL is not provided, localhost:5173 is used.

const allowedOrigins = String(
  process.env.CLIENT_URL ||
  "http://localhost:5173,http://localhost:5174",
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests and tools such as
      // Postman that do not send an Origin header.
      if (!origin) {
        return callback(null, true);
      }

      // Allow configured frontend origins.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error(
        "Origin not allowed by CORS",
      );

      error.statusCode = 403;

      return callback(error);
    },

    credentials: true,
  }),
);

// ============================================================
// PAYSTACK WEBHOOKS
// ============================================================
//
// IMPORTANT:
// These webhook routes MUST be mounted BEFORE express.json().
//
// Paystack signature verification requires the exact raw
// request body.
//
// Do NOT move these below app.use(express.json()).
// ============================================================

// ------------------------------------------------------------
// PAYSTACK PAYMENT WEBHOOK
// POST /api/webhooks/paystack
// ------------------------------------------------------------

app.use(
  "/api/webhooks",
  paymentWebhookRoutes,
);

// ------------------------------------------------------------
// PAYSTACK PAYOUT WEBHOOK
// POST /api/webhooks/paystack/payouts
// ------------------------------------------------------------

app.use(
  "/api/webhooks/paystack/payouts",
  express.raw({
    type: "application/json",
  }),
  payoutWebhookRoutes,
);

// ============================================================
// JSON BODY PARSER FOR NORMAL API ROUTES
// ============================================================

app.use(express.json());

// ============================================================
// CHAT ROUTES
// ============================================================

app.use(
  "/api/chats",
  chatRoutes,
);

// ============================================================
// AUTHENTICATION
// ============================================================

app.use(
  "/api/auth",
  authRoutes,
);

// ============================================================
// USERS
// ============================================================

app.use(
  "/api/users",
  userRoutes,
);

// ============================================================
// PROVIDERS
// ============================================================

app.use(
  "/api/providers",
  providerRoutes,
);

// ============================================================
// CATEGORIES
// ============================================================

app.use(
  "/api/categories",
  categoryRoutes,
);

// ============================================================
// SERVICES
// ============================================================

app.use(
  "/api/services",
  serviceRoutes,
);

// ============================================================
// OPPORTUNITIES
// ============================================================

app.use(
  "/api/opportunities",
  opportunityRoutes,
);

// ============================================================
// BOOKINGS
// ============================================================

app.use(
  "/api/bookings",
  bookingRoutes,
);

// ============================================================
// PAYMENTS
// ============================================================

app.use(
  "/api/payments",
  paymentRoutes,
);

// ============================================================
// REVIEWS
// ============================================================

app.use(
  "/api/reviews",
  reviewRoutes,
);

// ============================================================
// NOTIFICATIONS
// ============================================================

app.use(
  "/api/notifications",
  notificationRoutes,
);

// ============================================================
// DISPUTES
// ============================================================

app.use(
  "/api/disputes",
  disputeRoutes,
);

// ============================================================
// PROVIDER BANK ACCOUNTS
// ============================================================

app.use(
  "/api/provider/bank-accounts",
  bankAccountRoutes,
);

// Compatibility alias for clients that used the shorter bank-account path.
app.use(
  "/api/bank-accounts",
  bankAccountRoutes,
);

// ============================================================
// PAYOUTS
// ============================================================

app.use(
  "/api/payouts",
  payoutRoutes,
);

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Proservora API is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
  });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use(notFoundHandler);

// ============================================================
// CENTRAL ERROR HANDLER
// ============================================================

app.use(errorHandler);

// ============================================================
// EXPORT
// ============================================================

module.exports = app;
const express = require("express");

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

const app = express();

// ============================================================
// PAYSTACK PAYOUT WEBHOOK
// ============================================================

app.use(
  "/api/webhooks/paystack/payouts",
  express.raw({ type: "application/json" }),
  payoutWebhookRoutes,
);

// ============================================================
// JSON BODY PARSER FOR NORMAL API ROUTES
// ============================================================

app.use(express.json());
app.use("/api/chats", chatRoutes);

// ============================================================
// ROUTES
// ============================================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/disputes", disputeRoutes);

app.use("/api/webhooks", paymentWebhookRoutes);

app.use("/api/provider/bank-accounts", bankAccountRoutes);
app.use("/api/payouts", payoutRoutes);

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "NaijaFix API is running",
  });
});

module.exports = app;

require("dotenv").config();

const app = require("./src/app");
const {
  verifyEmailTransport,
} = require("./src/services/emailService");
const { runDatabaseMigrations } = require("./src/config/databaseMigrations");

const PORT = process.env.PORT || 3000;

const NODE_ENV = process.env.NODE_ENV || "development";

// ============================================================
// STARTUP CONFIGURATION CHECKS
// ============================================================

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not configured");
  process.exit(1);
}

if (!process.env.PAYSTACK_SECRET_KEY) {
  console.error("PAYSTACK_SECRET_KEY is not configured");
  process.exit(1);
}

if (!process.env.SMTP_HOST) {
  console.error("SMTP_HOST is not configured");
  process.exit(1);
}

if (!process.env.SMTP_USER) {
  console.error("SMTP_USER is not configured");
  process.exit(1);
}

if (!process.env.SMTP_PASS) {
  console.error("SMTP_PASS is not configured");
  process.exit(1);
}

if (!process.env.EMAIL_FROM) {
  console.error("EMAIL_FROM is not configured");
  process.exit(1);
}

// ============================================================
// MOCK PAYSTACK SAFETY
// ============================================================

if (
  NODE_ENV === "production" &&
  process.env.PAYSTACK_MOCK_TRANSFERS === "true"
) {
  console.error(
    "PAYSTACK_MOCK_TRANSFERS cannot be enabled in production",
  );

  process.exit(1);
}

// ============================================================
// START SERVER
// ============================================================

const startServer = async () => {
  try {
    await runDatabaseMigrations();
    await verifyEmailTransport();

    app.listen(PORT, () => {
      console.log(
        `Proservora API running on port ${PORT} (${NODE_ENV})`,
      );
    });
  } catch (error) {
    console.error(
      "Failed to initialize SMTP email transport.",
    );

    process.exit(1);
  }
};

startServer();
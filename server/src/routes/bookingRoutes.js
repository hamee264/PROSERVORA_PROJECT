const express = require("express");

const {
  createBooking,
  getMyBookings,
  acceptBooking,
  startBooking,
  completeBooking,
  confirmBooking,
} = require("../controllers/bookingController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// GET MY BOOKINGS
// ============================================================

router.get("/me", authenticate, getMyBookings);

// ============================================================
// PROVIDER - APPLY TO OPPORTUNITY
// ============================================================

router.post("/", authenticate, requireRole("provider"), createBooking);

router.patch(
  "/:bookingId/accept",
  authenticate,
  requireRole("provider"),
  acceptBooking,
);
// ============================================================
// START BOOKING
// ============================================================

router.patch(
  "/:bookingId/start",
  authenticate,
  requireRole("provider"),
  startBooking,
);
// ============================================================
// COMPLETE BOOKING
// ============================================================

router.patch(
  "/:bookingId/complete",
  authenticate,
  requireRole("provider"),
  completeBooking,
);
// ============================================================
// CUSTOMER CONFIRMS COMPLETED JOB
// ============================================================

router.patch(
  "/:bookingId/confirm",
  authenticate,
  requireRole("customer"),
  confirmBooking,
);
module.exports = router;

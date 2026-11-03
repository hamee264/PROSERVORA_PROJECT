const express = require("express");
const {
  createBooking,
  getMyBookings,
  acceptBooking,
  rejectBooking,
  withdrawBooking,
  cancelAcceptedBooking,
  startBooking,
  completeBooking,
  confirmBooking,
  scheduleBookingSession,
} = require("../controllers/bookingController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", authenticate, getMyBookings);

// Provider applications
router.post("/", authenticate, requireRole("provider"), createBooking);
router.patch("/:bookingId/withdraw", authenticate, requireRole("provider"), withdrawBooking);

// Customer application selection
router.patch("/:bookingId/accept", authenticate, requireRole("customer"), acceptBooking);
router.patch("/:bookingId/reject", authenticate, requireRole("customer"), rejectBooking);
router.patch("/:bookingId/cancel", authenticate, requireRole("customer"), cancelAcceptedBooking);
router.patch("/:bookingId/session", authenticate, requireRole("customer"), scheduleBookingSession);

// Job lifecycle
router.patch("/:bookingId/start", authenticate, requireRole("provider"), startBooking);
router.patch("/:bookingId/complete", authenticate, requireRole("provider"), completeBooking);
router.patch("/:bookingId/confirm", authenticate, requireRole("customer"), confirmBooking);

module.exports = router;

const bookingService = require("../services/bookingService");

// ============================================================
// CREATE BOOKING / APPLY TO OPPORTUNITY
// ============================================================

const createBooking = async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to create booking",
    });
  }
};
// ============================================================
// GET MY BOOKINGS
// ============================================================

const getMyBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getMyBookings(
      req.user.id,
      req.user.role,
    );

    res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get bookings",
    });
  }
};
// ============================================================
// ACCEPT BOOKING APPLICATION
// ============================================================

const acceptBooking = async (req, res) => {
  try {
    const booking = await bookingService.acceptBooking(
      req.user.id,
      req.params.bookingId,
    );

    res.status(200).json({
      success: true,
      message: "Booking accepted successfully",
      booking,
    });
  } catch (error) {
    console.error("Accept booking error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to accept booking",
    });
  }
};
// ============================================================
// START BOOKING
// ============================================================

const startBooking = async (req, res) => {
  try {
    const booking = await bookingService.startBooking(
      req.user.id,
      req.params.bookingId,
    );

    res.status(200).json({
      success: true,
      message: "Job started successfully",
      booking,
    });
  } catch (error) {
    console.error("Start booking error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to start booking",
    });
  }
};
// ============================================================
// COMPLETE BOOKING
// ============================================================

const completeBooking = async (req, res) => {
  try {
    const booking = await bookingService.completeBooking(
      req.user.id,
      req.params.bookingId,
    );

    res.status(200).json({
      success: true,
      message: "Job completed successfully",
      booking,
    });
  } catch (error) {
    console.error("Complete booking error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to complete booking",
    });
  }
};
// ============================================================
// CUSTOMER CONFIRMS COMPLETED JOB
// ============================================================

const confirmBooking = async (req, res) => {
  try {
    const booking = await bookingService.confirmBooking(
      req.user.id,
      req.params.bookingId,
    );

    res.status(200).json({
      success: true,
      message: "Job completion confirmed successfully",
      booking,
    });
  } catch (error) {
    console.error("Confirm booking error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to confirm booking",
    });
  }
};
module.exports = {
  createBooking,
  getMyBookings,
  acceptBooking,
  startBooking,
  completeBooking,
  confirmBooking,
};

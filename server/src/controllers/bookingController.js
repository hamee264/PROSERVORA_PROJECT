const bookingService = require("../services/bookingService");

const handle = (action, successMessage) => async (req, res) => {
  try {
    const booking = await action(req);
    return res.status(200).json({ success: true, message: successMessage, booking });
  } catch (error) {
    console.error(`${successMessage} error:`, error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Booking operation failed" });
  }
};

const createBooking = async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.user.id, req.body);
    return res.status(201).json({ success: true, message: "Application submitted successfully", booking });
  } catch (error) {
    console.error("Create booking error:", error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Unable to create booking" });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getMyBookings(req.user.id, req.user.role);
    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Get my bookings error:", error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Unable to get bookings" });
  }
};

const acceptBooking = handle(
  req => bookingService.acceptBooking(req.user.id, req.params.bookingId),
  "Booking selected successfully",
);

const rejectBooking = handle(
  req => bookingService.rejectBooking(req.user.id, req.params.bookingId),
  "Application declined successfully",
);

const withdrawBooking = handle(
  req => bookingService.withdrawBooking(req.user.id, req.params.bookingId),
  "Application withdrawn successfully",
);

const cancelAcceptedBooking = handle(
  req => bookingService.cancelAcceptedBooking(req.user.id, req.params.bookingId),
  "Booking cancelled successfully",
);

const startBooking = handle(
  req => bookingService.startBooking(req.user.id, req.params.bookingId),
  "Job started successfully",
);

const completeBooking = handle(
  req => bookingService.completeBooking(req.user.id, req.params.bookingId),
  "Job completed successfully",
);

const confirmBooking = handle(
  req => bookingService.confirmBooking(req.user.id, req.params.bookingId),
  "Job completion confirmed and payment released successfully",
);

const scheduleBookingSession = handle(
  req =>
    bookingService.scheduleBookingSession(
      req.user.id,
      req.params.bookingId,
      req.body,
    ),
  "Booking session scheduled successfully",
);

module.exports = {
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
};

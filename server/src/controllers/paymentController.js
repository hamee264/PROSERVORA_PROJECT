const paymentService = require("../services/paymentService");

const getMyPayments = async (req, res) => {
  try {
    const payments = await paymentService.getMyPayments(req.user.id);

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Get customer payments error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to get payments",
    });
  }
};

const initializePayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const result = await paymentService.createPayment(
      req.user.id,
      bookingId,
      "paystack",
    );

    return res.status(201).json({
      success: true,
      message: "Payment initialized successfully",
      booking: result.booking,
      payment: result.payment,
      checkout: result.paystack,
    });
  } catch (error) {
    console.error("Initialize payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to initialize payment",
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    const result = await paymentService.verifyPayment(
      req.user.id,
      reference,
    );

    return res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? "Payment has already been verified"
        : "Payment verified successfully",
      payment: result.payment,
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to verify payment",
    });
  }
};

module.exports = {
  getMyPayments,
  initializePayment,
  verifyPayment,
};
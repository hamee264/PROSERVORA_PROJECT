const disputeService = require("../services/disputeService");

// ============================================================
// CREATE DISPUTE
// ============================================================

const createDispute = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const {
      bookingId,
      reason,
      description,
    } = req.body;

    const dispute =
      await disputeService.createDispute({
        bookingId,
        userId,
        reason,
        description,
      });

    res.status(201).json({
      success: true,
      message: "Dispute opened successfully",
      dispute,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY DISPUTES
// ============================================================

const getMyDisputes = async (
  req,
  res,
  next,
) => {
  try {
    const userId = req.user.id;

    const disputes =
      await disputeService.getMyDisputes(userId);

    res.status(200).json({
      success: true,
      disputes,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE DISPUTE
// ============================================================

const getDispute = async (
  req,
  res,
  next,
) => {
  try {
    const userId = req.user.id;
    const { disputeId } = req.params;

    if (!disputeId) {
      const error = new Error(
        "Dispute ID is required",
      );
      error.statusCode = 400;
      throw error;
    }

    const dispute =
      await disputeService.getDisputeForUser(
        disputeId,
        userId,
      );

    res.status(200).json({
      success: true,
      dispute,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADD DISPUTE MESSAGE
// ============================================================

const addDisputeMessage = async (
  req,
  res,
  next,
) => {
  try {
    const userId = req.user.id;
    const { disputeId } = req.params;
    const { message } = req.body;

    if (!disputeId) {
      const error = new Error(
        "Dispute ID is required",
      );
      error.statusCode = 400;
      throw error;
    }

    const result =
      await disputeService.addDisputeMessage({
        disputeId,
        userId,
        message,
      });

    res.status(201).json({
      success: true,
      message: "Message added successfully",
      disputeMessage: result,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createDispute,
  getMyDisputes,
  getDispute,
  addDisputeMessage,
};
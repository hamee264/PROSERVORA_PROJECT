const {
  calculatePayoutDetails,
  getProviderWallet,
  createPayout,
  initiatePaystackTransfer,
  getProviderPayout,
  getProviderPayouts,
} = require("../services/payoutService");
// ============================================================
// GET WITHDRAWAL PREVIEW
// ============================================================

const getPayoutPreview = async (req, res) => {
  try {
    const { amount } = req.query;

    const payoutDetails = calculatePayoutDetails(amount);

    return res.status(200).json({
      success: true,

      payout: payoutDetails,
    });
  } catch (error) {
    console.error("Get payout preview error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to calculate withdrawal fee",
    });
  }
};

// ============================================================
// GET PROVIDER WALLET
// ============================================================

const getWallet = async (req, res) => {
  try {
    const providerId = req.user.id;

    const wallet = await getProviderWallet(providerId);

    return res.status(200).json({
      success: true,

      wallet,
    });
  } catch (error) {
    console.error("Get provider wallet error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to retrieve wallet",
    });
  }
};

// ============================================================
// REQUEST WITHDRAWAL
// ============================================================

// ============================================================
// REQUEST WITHDRAWAL
// ============================================================

const requestPayout = async (req, res) => {
  try {
    const providerId = req.user.id;

    const { amount } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal amount is required",
      });
    }

    // ========================================================
    // CREATE PAYOUT
    // ========================================================

    const result = await createPayout(providerId, amount);

    // ========================================================
    // INITIATE PAYSTACK
    // ========================================================

    const transferResult = await initiatePaystackTransfer(result.payout.id);

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message: "Withdrawal request submitted successfully",

      payout: transferResult.payout,

      wallet: result.wallet,

      walletTransaction: result.walletTransaction,

      bankAccount: result.bankAccount,

      payoutDetails: {
        requestedAmount: result.requestedAmount,
        withdrawalFee: result.withdrawalFee,
        providerAmount: result.providerAmount,
        platformRevenue: result.platformRevenue,
      },

      paystack: transferResult.paystack,
    });
  } catch (error) {
    console.error("Request payout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to process withdrawal",
    });
  }
};

// ============================================================
// GET PAYOUTS
// ============================================================

const getPayoutHistory = async (req, res) => {
  try {
    const providerId = req.user.id;

    const payouts = await getProviderPayouts(providerId);

    return res.status(200).json({
      success: true,

      payouts,
    });
  } catch (error) {
    console.error("Get payout history error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to retrieve payouts",
    });
  }
};

// ============================================================
// GET SINGLE PAYOUT
// ============================================================

const getPayout = async (req, res) => {
  try {
    const providerId = req.user.id;

    const { payoutId } = req.params;

    const payout = await getProviderPayout(providerId, payoutId);

    return res.status(200).json({
      success: true,

      payout,
    });
  } catch (error) {
    console.error("Get payout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to retrieve payout",
    });
  }
};

module.exports = {
  getPayoutPreview,
  getWallet,
  requestPayout,
  getPayoutHistory,
  getPayout,
};

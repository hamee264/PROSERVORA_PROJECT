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
      message:
        error.message || "Unable to calculate withdrawal fee",
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
      message:
        error.message || "Unable to retrieve wallet",
    });
  }
};

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
    // CREATE + RESERVE PAYOUT
    // ========================================================

    const result = await createPayout(
      providerId,
      amount,
    );

    // ========================================================
    // INITIATE PAYSTACK
    // ========================================================
    //
    // This function:
    //
    // 1. marks the payout processing
    // 2. commits that state
    // 3. calls Paystack outside the DB transaction
    //
    // If Paystack definitively rejects the transfer, the
    // payout service restores the reserved funds.
    //
    // If the result is uncertain, the payout remains
    // processing and Paystack's webhook resolves it later.
    //
    // ========================================================

    const transferResult =
      await initiatePaystackTransfer(
        result.payout.id,
      );

    // ========================================================
    // UNCERTAIN PAYSTACK RESULT
    // ========================================================

    if (transferResult.uncertain) {
      return res.status(202).json({
        success: true,

        message:
          "Withdrawal is being processed. Paystack confirmation is still pending.",

        payout: transferResult.payout,

        wallet: result.wallet,

        walletTransaction:
          result.walletTransaction,

        bankAccount: result.bankAccount,

        payoutDetails: {
          requestedAmount:
            result.requestedAmount,

          withdrawalFee:
            result.withdrawalFee,

          providerAmount:
            result.providerAmount,

          platformRevenue:
            result.platformRevenue,
        },

        paystack:
          transferResult.paystack || null,
      });
    }

    // ========================================================
    // DEFINITIVE PAYSTACK FAILURE
    // ========================================================

    if (transferResult.failed) {
      return res.status(502).json({
        success: false,

        message:
          transferResult.message ||
          "Paystack rejected the withdrawal",

        payout: transferResult.payout,

        wallet: transferResult.wallet || result.wallet,

        walletTransaction:
          result.walletTransaction,

        bankAccount: result.bankAccount,

        payoutDetails: {
          requestedAmount:
            result.requestedAmount,

          withdrawalFee:
            result.withdrawalFee,

          providerAmount:
            result.providerAmount,

          platformRevenue:
            result.platformRevenue,
        },
      });
    }

    // ========================================================
    // NORMAL PROCESSING RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message:
        "Withdrawal request submitted successfully",

      payout: transferResult.payout,

      wallet: result.wallet,

      walletTransaction:
        result.walletTransaction,

      bankAccount: result.bankAccount,

      payoutDetails: {
        requestedAmount:
          result.requestedAmount,

        withdrawalFee:
          result.withdrawalFee,

        providerAmount:
          result.providerAmount,

        platformRevenue:
          result.platformRevenue,
      },

      paystack:
        transferResult.paystack || null,
    });
  } catch (error) {
    console.error("Request payout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to process withdrawal",
    });
  }
};

// ============================================================
// GET PAYOUTS
// ============================================================

const getPayoutHistory = async (req, res) => {
  try {
    const providerId = req.user.id;

    const payouts =
      await getProviderPayouts(providerId);

    return res.status(200).json({
      success: true,
      payouts,
    });
  } catch (error) {
    console.error(
      "Get payout history error:",
      error,
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to retrieve payouts",
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

    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: "Payout ID is required",
      });
    }

    const payout =
      await getProviderPayout(
        providerId,
        payoutId,
      );

    return res.status(200).json({
      success: true,
      payout,
    });
  } catch (error) {
    console.error("Get payout error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Unable to retrieve payout",
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
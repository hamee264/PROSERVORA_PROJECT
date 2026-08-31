const axios = require("axios");
const pool = require("../config/database");

const { createNotification } = require("./notificationService");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// ============================================================
// PAYSTACK HEADERS
// ============================================================

const paystackHeaders = {
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

// ============================================================
// MOCK CONFIGURATION
// ============================================================
//
// .env:
//
// PAYSTACK_MOCK_TRANSFERS=true
// PAYSTACK_MOCK_TRANSFER_STATUS=success
//
// Supported statuses:
//
// success
// pending
// failed
// reversed
//
// ============================================================

const isMockTransferEnabled = () => {
  return process.env.PAYSTACK_MOCK_TRANSFERS === "true";
};

const getMockTransferStatus = () => {
  const status = String(
    process.env.PAYSTACK_MOCK_TRANSFER_STATUS || "success",
  ).toLowerCase();

  const allowedStatuses = ["success", "pending", "failed", "reversed"];

  if (!allowedStatuses.includes(status)) {
    return "success";
  }

  return status;
};

// ============================================================
// WITHDRAWAL FEE
// ============================================================
//
// Provider requests:
//
// ₦1 - ₦50,000          → ₦500
// ₦50,001 - ₦100,000    → ₦1,000
// ₦100,001 - ₦200,000   → ₦1,500
// ₦200,001 - ₦500,000   → ₦2,500
// ₦500,001+             → ₦5,000
//
// ============================================================

const calculateWithdrawalFee = (amount) => {
  if (amount <= 50000) {
    return 500;
  }

  if (amount <= 100000) {
    return 1000;
  }

  if (amount <= 200000) {
    return 1500;
  }

  if (amount <= 500000) {
    return 2500;
  }

  return 5000;
};

// ============================================================
// CALCULATE PAYOUT DETAILS
// ============================================================

const calculatePayoutDetails = (amount) => {
  const requestedAmount = Number(amount);

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    const error = new Error("Invalid withdrawal amount");

    error.statusCode = 400;

    throw error;
  }

  const withdrawalFee = calculateWithdrawalFee(requestedAmount);

  const providerAmount = requestedAmount - withdrawalFee;

  if (providerAmount <= 0) {
    const error = new Error("Withdrawal amount is too small after fees");

    error.statusCode = 400;

    throw error;
  }

  return {
    requestedAmount,
    withdrawalFee,
    providerAmount,
    platformRevenue: withdrawalFee,
  };
};

// ============================================================
// GET PROVIDER WALLET
// ============================================================

const getProviderWallet = async (providerId, client = pool) => {
  const result = await client.query(
    `
    SELECT
      id,
      provider_id,
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn,
      currency,
      created_at,
      updated_at

    FROM provider_wallets

    WHERE provider_id = $1

    FOR UPDATE
    `,
    [providerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Provider wallet not found");

    error.statusCode = 404;

    throw error;
  }

  return result.rows[0];
};

// ============================================================
// CREATE PAYOUT
// ============================================================
//
// Provider requests a withdrawal.
//
// Example:
//
// Requested amount: ₦50,000
// NaijaFix fee:       ₦500
// Provider receives: ₦49,500
//
// The FULL requested amount is reserved.
//
// ============================================================

const createPayout = async (providerId, requestedAmount) => {
  const amount = Number(requestedAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Invalid withdrawal amount");

    error.statusCode = 400;

    throw error;
  }

  if (!Number.isInteger(amount)) {
    const error = new Error("Withdrawal amount must be a whole naira amount");

    error.statusCode = 400;

    throw error;
  }

  const details = calculatePayoutDetails(amount);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // LOCK PROVIDER WALLET
    // ========================================================

    const wallet = await getProviderWallet(providerId, client);

    // ========================================================
    // ONLY NGN FOR NOW
    // ========================================================

    if (wallet.currency !== "NGN") {
      const error = new Error("Only NGN withdrawals are currently supported");

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // CHECK AVAILABLE BALANCE
    // ========================================================

    const availableBalance = Number(wallet.available_balance);

    if (availableBalance < details.requestedAmount) {
      const error = new Error(
        `Insufficient available balance. You need ₦${details.requestedAmount.toLocaleString()} to withdraw this amount.`,
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // GET DEFAULT BANK ACCOUNT
    // ========================================================

    const bankAccountResult = await client.query(
      `
      SELECT
        id,
        provider_id,
        bank_code,
        bank_name,
        account_number,
        account_name,
        recipient_code,
        is_verified,
        is_default

      FROM provider_bank_accounts

      WHERE provider_id = $1

        AND is_default = true

        AND is_verified = true

      LIMIT 1
      `,
      [providerId],
    );

    if (bankAccountResult.rows.length === 0) {
      const error = new Error(
        "You must add and verify a default bank account before withdrawing",
      );

      error.statusCode = 400;

      throw error;
    }

    const bankAccount = bankAccountResult.rows[0];

    // ========================================================
    // CHECK RECIPIENT CODE
    // ========================================================

    if (!bankAccount.recipient_code) {
      const error = new Error(
        "Your bank account is missing a Paystack recipient code",
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // BALANCE CALCULATION
    // ========================================================

    const balanceBefore = availableBalance;

    const balanceAfter = balanceBefore - details.requestedAmount;

    // ========================================================
    // RESERVE FULL REQUESTED AMOUNT
    // ========================================================

    const walletResult = await client.query(
      `
      UPDATE provider_wallets

      SET
        available_balance =
          available_balance - $1,

        updated_at = NOW()

      WHERE id = $2

        AND available_balance >= $1

      RETURNING
        id,
        provider_id,
        available_balance,
        pending_balance,
        total_earned,
        total_withdrawn,
        currency,
        created_at,
        updated_at
      `,
      [details.requestedAmount, wallet.id],
    );

    if (walletResult.rows.length === 0) {
      const error = new Error("Unable to reserve withdrawal amount");

      error.statusCode = 409;

      throw error;
    }

    const updatedWallet = walletResult.rows[0];

    // ========================================================
    // CREATE PAYOUT
    // ========================================================

    const payoutResult = await client.query(
      `
      INSERT INTO payouts (
        provider_id,
        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        platform_revenue,
        currency,
        status,
        payout_provider,
        bank_account_id,
        recipient_code
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'pending',
        'paystack',
        $8,
        $9
      )

      RETURNING
        id,
        provider_id,
        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        paystack_fee,
        stamp_duty,
        platform_revenue,
        currency,
        status,
        payout_provider,
        provider_reference,
        created_at,
        paid_at,
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        updated_at
      `,
      [
        providerId,
        details.requestedAmount,
        details.requestedAmount,
        details.withdrawalFee,
        details.providerAmount,
        details.platformRevenue,
        wallet.currency,
        bankAccount.id,
        bankAccount.recipient_code,
      ],
    );

    const payout = payoutResult.rows[0];

    // ========================================================
    // RECORD WALLET RESERVATION
    // ========================================================

    const transactionResult = await client.query(
      `
      INSERT INTO wallet_transactions (
        provider_id,
        type,
        amount,
        currency,
        reference,
        description,
        balance_before,
        balance_after,
        payout_id
      )

      VALUES (
        $1,
        'debit',
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )

      RETURNING
        id,
        provider_id,
        type,
        amount,
        currency,
        reference,
        description,
        balance_before,
        balance_after,
        payout_id,
        created_at
      `,
      [
        providerId,

        details.requestedAmount,

        wallet.currency,

        `PAYOUT-RESERVE-${payout.id}`,

        `Withdrawal request: ₦${details.requestedAmount.toLocaleString()} including ₦${details.withdrawalFee.toLocaleString()} NaijaFix withdrawal fee`,

        balanceBefore,

        balanceAfter,

        payout.id,
      ],
    );

    // ========================================================
    // NOTIFICATION — PAYOUT CREATED
    // ========================================================

    await createNotification({
      userId: providerId,
      type: "payout_requested",
      title: "Withdrawal request submitted",
      message: `Your withdrawal request for ₦${details.requestedAmount.toLocaleString()} has been submitted. You will receive ₦${details.providerAmount.toLocaleString()} after the ₦${details.withdrawalFee.toLocaleString()} withdrawal fee.`,
      actionUrl: "/provider/payouts",
      client,
    });

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    // ========================================================
    // RETURN
    // ========================================================

    return {
      payout,

      wallet: updatedWallet,

      walletTransaction: transactionResult.rows[0],

      requestedAmount: details.requestedAmount,

      withdrawalFee: details.withdrawalFee,

      providerAmount: details.providerAmount,

      platformRevenue: details.platformRevenue,

      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bank_name,
        accountName: bankAccount.account_name,
        accountNumber: bankAccount.account_number,
        recipientCode: bankAccount.recipient_code,
      },
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Payout rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// INITIATE PAYSTACK TRANSFER
// ============================================================
//
// Wallet has already reserved the FULL requested amount.
//
// Example:
//
// requestedAmount = ₦50,000
// withdrawalFee  = ₦500
// providerAmount = ₦49,500
//
// Paystack receives ₦49,500.
//
// ============================================================

const initiatePaystackTransfer = async (payoutId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // LOCK PAYOUT
    // ========================================================

    const payoutResult = await client.query(
      `
      SELECT
        p.id,
        p.provider_id,

        p.amount,
        p.requested_amount,
        p.withdrawal_fee,
        p.provider_amount,
        p.paystack_fee,
        p.stamp_duty,
        p.platform_revenue,

        p.currency,
        p.status,
        p.payout_provider,
        p.provider_reference,
        p.bank_account_id,
        p.recipient_code,
        p.failure_reason,

        ba.bank_name,
        ba.account_name,
        ba.account_number

      FROM payouts p

      INNER JOIN provider_bank_accounts ba
        ON ba.id = p.bank_account_id

      WHERE p.id = $1

      FOR UPDATE
      `,
      [payoutId],
    );

    if (payoutResult.rows.length === 0) {
      const error = new Error("Payout not found");

      error.statusCode = 404;

      throw error;
    }

    const payout = payoutResult.rows[0];

    // ========================================================
    // PREVENT DUPLICATE TRANSFER
    // ========================================================

    if (payout.status === "processing" || payout.status === "paid") {
      await client.query("COMMIT");

      return {
        payout,
        alreadyInitiated: true,
      };
    }

    // ========================================================
    // ONLY PENDING PAYOUTS
    // ========================================================

    if (payout.status !== "pending") {
      const error = new Error(
        `Payout cannot be transferred because its status is ${payout.status}`,
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // VALIDATE PROVIDER AMOUNT
    // ========================================================

    const providerAmount = Number(payout.provider_amount);

    if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
      const error = new Error("Invalid provider payout amount");

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // GENERATE UNIQUE REFERENCE
    // ========================================================

    const reference = `nf_payout_${payout.id}`;

    // ========================================================
    // MOCK PAYSTACK TRANSFER
    // ========================================================

    if (isMockTransferEnabled()) {
      const mockResult = getMockTransferStatus();

      console.log("");
      console.log("============================================");
      console.log("🧪 MOCK PAYSTACK TRANSFER");
      console.log("============================================");
      console.log("Payout ID:", payout.id);
      console.log("Provider:", payout.provider_id);
      console.log("Amount:", `₦${providerAmount.toLocaleString()}`);
      console.log("Bank:", payout.bank_name);
      console.log("Account:", payout.account_number);
      console.log("Result:", mockResult);
      console.log("============================================");
      console.log("");

      // ======================================================
      // MARK PROCESSING
      // ======================================================

      const processingPayoutResult = await client.query(
        `
        UPDATE payouts

        SET
          status = 'processing',

          provider_reference = $1,

          processed_at = NOW(),

          updated_at = NOW()

        WHERE id = $2

        RETURNING
          id,
          provider_id,
          amount,
          requested_amount,
          withdrawal_fee,
          provider_amount,
          paystack_fee,
          stamp_duty,
          platform_revenue,
          currency,
          status,
          payout_provider,
          provider_reference,
          created_at,
          paid_at,
          bank_account_id,
          recipient_code,
          failure_reason,
          processed_at,
          updated_at
        `,
        [reference, payout.id],
      );

      // ======================================================
      // NOTIFICATION — PROCESSING
      // ======================================================

      await createNotification({
        userId: payout.provider_id,
        type: "payout_processing",
        title: "Withdrawal is being processed",
        message: `Your withdrawal request for ₦${Number(
          payout.requested_amount,
        ).toLocaleString()} is now being processed. ₦${providerAmount.toLocaleString()} will be sent to your bank account.`,
        actionUrl: "/provider/payouts",
        client,
      });

      await client.query("COMMIT");

      const mockTransfer = {
        reference,

        transferCode: `MOCK_TRANSFER_${payout.id}`,

        status: mockResult === "success" ? "success" : mockResult,

        amount: Math.round(providerAmount * 100),

        currency: payout.currency,
      };

      // ======================================================
      // MOCK SUCCESS
      // ======================================================

      if (mockResult === "success") {
        const successResult = await handleTransferSuccess({
          reference,
        });

        console.log("🧪 MOCK PAYSTACK TRANSFER SUCCESS");
        console.log("Payout marked as paid.");
        console.log("");

        return {
          payout: successResult.payout,

          paystack: {
            ...mockTransfer,

            status: "success",
          },

          alreadyInitiated: false,

          mock: true,
        };
      }

      // ======================================================
      // MOCK FAILURE
      // ======================================================

      if (mockResult === "failed") {
        const failureResult = await handleTransferFailed({
          reference,

          reason: "Mock Paystack transfer failed",
        });

        console.log("🧪 MOCK PAYSTACK TRANSFER FAILED");
        console.log("Reserved funds have been refunded.");
        console.log("");

        return {
          payout: failureResult.payout,

          paystack: {
            ...mockTransfer,

            status: "failed",
          },

          alreadyInitiated: false,

          mock: true,
        };
      }

      // ======================================================
      // MOCK REVERSED
      // ======================================================

      if (mockResult === "reversed") {
        const reversalResult = await handleTransferReversed({
          reference,

          reason: "Mock Paystack transfer reversed",
        });

        console.log("🧪 MOCK PAYSTACK TRANSFER REVERSED");
        console.log("Reserved funds have been refunded.");
        console.log("");

        return {
          payout: reversalResult.payout,

          paystack: {
            ...mockTransfer,

            status: "reversed",
          },

          alreadyInitiated: false,

          mock: true,
        };
      }

      // ======================================================
      // MOCK PENDING
      // ======================================================

      return {
        payout: processingPayoutResult.rows[0],

        paystack: {
          ...mockTransfer,

          status: "pending",
        },

        alreadyInitiated: false,

        mock: true,
      };
    }

    // ========================================================
    // REAL PAYSTACK TRANSFER
    // ========================================================

    let paystackResponse;

    try {
      paystackResponse = await axios.post(
        `${PAYSTACK_BASE_URL}/transfer`,
        {
          source: "balance",

          amount: Math.round(providerAmount * 100),

          recipient: payout.recipient_code,

          reference,

          reason: "NaijaFix provider withdrawal",

          currency: payout.currency,
        },
        {
          headers: paystackHeaders,
        },
      );
    } catch (error) {
      console.error(
        "Paystack payout initiation error:",
        error.response?.data || error.message,
      );

      await restoreFailedPayoutFunds(
        payout,
        error.response?.data?.message || "Unable to initiate Paystack transfer",
        client,
      );

      await client.query("COMMIT");

      const payoutError = new Error(
        error.response?.data?.message ||
          "Unable to initiate payout with Paystack",
      );

      payoutError.statusCode = 502;

      throw payoutError;
    }

    // ========================================================
    // CHECK PAYSTACK RESPONSE
    // ========================================================

    if (
      !paystackResponse.data ||
      !paystackResponse.data.status ||
      !paystackResponse.data.data
    ) {
      await restoreFailedPayoutFunds(
        payout,
        "Paystack failed to initiate transfer",
        client,
      );

      await client.query("COMMIT");

      const error = new Error(
        "Paystack failed to initiate the provider transfer",
      );

      error.statusCode = 502;

      throw error;
    }

    const transfer = paystackResponse.data.data;

    // ========================================================
    // PAYSTACK REFERENCE
    // ========================================================

    const providerReference = transfer.reference || reference;

    // ========================================================
    // MARK PAYOUT PROCESSING
    // ========================================================

    const updatedPayoutResult = await client.query(
      `
      UPDATE payouts

      SET
        status = 'processing',

        provider_reference = $1,

        processed_at = NOW(),

        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        provider_id,
        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        paystack_fee,
        stamp_duty,
        platform_revenue,
        currency,
        status,
        payout_provider,
        provider_reference,
        created_at,
        paid_at,
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        updated_at
      `,
      [providerReference, payout.id],
    );

    // ========================================================
    // NOTIFICATION — PROCESSING
    // ========================================================

    await createNotification({
      userId: payout.provider_id,
      type: "payout_processing",
      title: "Withdrawal is being processed",
      message: `Your withdrawal request for ₦${Number(
        payout.requested_amount,
      ).toLocaleString()} is now being processed. ₦${providerAmount.toLocaleString()} will be sent to your bank account.`,
      actionUrl: "/provider/payouts",
      client,
    });

    await client.query("COMMIT");

    return {
      payout: updatedPayoutResult.rows[0],

      paystack: {
        reference: providerReference,

        transferCode: transfer.transfer_code,

        status: transfer.status,

        amount: transfer.amount,

        currency: transfer.currency,
      },

      alreadyInitiated: false,

      mock: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Payout transfer rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// RESTORE FAILED PAYOUT FUNDS
// ============================================================

const restoreFailedPayoutFunds = async (payout, failureReason, client) => {
  // ========================================================
  // LOCK WALLET
  // ========================================================

  const walletResult = await client.query(
    `
    SELECT
      id,
      provider_id,
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn,
      currency

    FROM provider_wallets

    WHERE provider_id = $1

    FOR UPDATE
    `,
    [payout.provider_id],
  );

  if (walletResult.rows.length === 0) {
    throw new Error("Provider wallet not found while restoring payout funds");
  }

  const wallet = walletResult.rows[0];

  // ========================================================
  // CHECK EXISTING REFUND
  // ========================================================

  const existingRefund = await client.query(
    `
    SELECT id

    FROM wallet_transactions

    WHERE payout_id = $1

      AND type = 'refund'

    LIMIT 1
    `,
    [payout.id],
  );

  if (existingRefund.rows.length > 0) {
    return;
  }

  // ========================================================
  // RESTORE FULL REQUESTED AMOUNT
  // ========================================================

  const refundAmount = Number(payout.amount);

  const balanceBefore = Number(wallet.available_balance);

  const balanceAfter = balanceBefore + refundAmount;

  const updatedWalletResult = await client.query(
    `
    UPDATE provider_wallets

    SET
      available_balance =
        available_balance + $1,

      updated_at = NOW()

    WHERE id = $2

    RETURNING
      id,
      provider_id,
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn,
      currency,
      created_at,
      updated_at
    `,
    [refundAmount, wallet.id],
  );

  if (updatedWalletResult.rows.length === 0) {
    throw new Error("Unable to restore payout funds");
  }

  // ========================================================
  // MARK PAYOUT FAILED
  // ========================================================

  await client.query(
    `
    UPDATE payouts

    SET
      status = 'failed',

      failure_reason = $1,

      updated_at = NOW()

    WHERE id = $2
    `,
    [String(failureReason), payout.id],
  );

  // ========================================================
  // WALLET REFUND TRANSACTION
  // ========================================================

  await client.query(
    `
    INSERT INTO wallet_transactions (
      provider_id,
      type,
      amount,
      currency,
      reference,
      description,
      balance_before,
      balance_after,
      payout_id
    )

    VALUES (
      $1,
      'refund',
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
    `,
    [
      payout.provider_id,

      refundAmount,

      payout.currency,

      `PAYOUT-REFUND-${payout.id}`,

      `Withdrawal returned because Paystack transfer failed: ${failureReason}`,

      balanceBefore,

      balanceAfter,

      payout.id,
    ],
  );

  // ========================================================
  // NOTIFICATION — FAILED
  // ========================================================

  await createNotification({
    userId: payout.provider_id,
    type: "payout_failed",
    title: "Withdrawal failed",
    message: `Your withdrawal of ₦${refundAmount.toLocaleString()} could not be completed. The full amount has been returned to your available balance. Reason: ${String(
      failureReason,
    )}`,
    actionUrl: "/provider/payouts",
    client,
  });
};

// ============================================================
// HANDLE TRANSFER SUCCESS
// ============================================================

const handleTransferSuccess = async (paystackTransfer) => {
  const reference = paystackTransfer.reference;

  if (!reference) {
    throw new Error("Paystack transfer reference is missing");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // FIND PAYOUT
    // ========================================================

    const payoutResult = await client.query(
      `
      SELECT
        id,
        provider_id,

        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        platform_revenue,

        currency,
        status,
        provider_reference

      FROM payouts

      WHERE provider_reference = $1

      FOR UPDATE
      `,
      [reference],
    );

    if (payoutResult.rows.length === 0) {
      await client.query("ROLLBACK");

      console.warn(
        "Received Paystack transfer.success for unknown payout:",
        reference,
      );

      return {
        found: false,
      };
    }

    const payout = payoutResult.rows[0];

    // ========================================================
    // ALREADY PAID
    // ========================================================

    if (payout.status === "paid") {
      await client.query("COMMIT");

      return {
        found: true,

        alreadyProcessed: true,

        payout,
      };
    }

    // ========================================================
    // ONLY PROCESS PROCESSING PAYOUT
    // ========================================================

    if (payout.status !== "processing") {
      await client.query("COMMIT");

      return {
        found: true,

        alreadyProcessed: false,

        payout,
      };
    }

    // ========================================================
    // MARK PAYOUT PAID
    // ========================================================

    const updatedPayoutResult = await client.query(
      `
      UPDATE payouts

      SET
        status = 'paid',

        paid_at = NOW(),

        processed_at =
          COALESCE(
            processed_at,
            NOW()
          ),

        updated_at = NOW()

      WHERE id = $1

      RETURNING
        id,
        provider_id,
        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        paystack_fee,
        stamp_duty,
        platform_revenue,
        currency,
        status,
        payout_provider,
        provider_reference,
        created_at,
        paid_at,
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        updated_at
      `,
      [payout.id],
    );

    // ========================================================
    // UPDATE TOTAL WITHDRAWN
    // ========================================================

    const walletResult = await client.query(
      `
      UPDATE provider_wallets

      SET
        total_withdrawn =
          total_withdrawn + $1,

        updated_at = NOW()

      WHERE provider_id = $2

      RETURNING
        id,
        provider_id,
        available_balance,
        pending_balance,
        total_earned,
        total_withdrawn,
        currency,
        created_at,
        updated_at
      `,
      [payout.amount, payout.provider_id],
    );

    if (walletResult.rows.length === 0) {
      throw new Error("Provider wallet not found while completing payout");
    }

    // ========================================================
    // NOTIFICATION — SUCCESS
    // ========================================================

    await createNotification({
      userId: payout.provider_id,
      type: "payout_paid",
      title: "Withdrawal successful",
      message: `Your withdrawal of ₦${Number(
        payout.requested_amount,
      ).toLocaleString()} has been completed successfully. ₦${Number(
        payout.provider_amount,
      ).toLocaleString()} has been sent to your bank account.`,
      actionUrl: "/provider/payouts",
      client,
    });

    await client.query("COMMIT");

    return {
      found: true,

      alreadyProcessed: false,

      payout: updatedPayoutResult.rows[0],

      wallet: walletResult.rows[0],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// HANDLE TRANSFER FAILED
// ============================================================

const handleTransferFailed = async (paystackTransfer) => {
  return handleTransferFailure(paystackTransfer, "Paystack transfer failed");
};

// ============================================================
// HANDLE TRANSFER REVERSED
// ============================================================

const handleTransferReversed = async (paystackTransfer) => {
  return handleTransferFailure(
    paystackTransfer,
    "Paystack transfer was reversed",
  );
};

// ============================================================
// HANDLE TRANSFER FAILURE / REVERSAL
// ============================================================

const handleTransferFailure = async (paystackTransfer, defaultReason) => {
  const reference = paystackTransfer.reference;

  if (!reference) {
    throw new Error("Paystack transfer reference is missing");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // FIND PAYOUT
    // ========================================================

    const payoutResult = await client.query(
      `
      SELECT
        id,
        provider_id,

        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        platform_revenue,

        currency,
        status,
        provider_reference

      FROM payouts

      WHERE provider_reference = $1

      FOR UPDATE
      `,
      [reference],
    );

    if (payoutResult.rows.length === 0) {
      await client.query("ROLLBACK");

      console.warn(
        "Received Paystack transfer failure for unknown payout:",
        reference,
      );

      return {
        found: false,
      };
    }

    const payout = payoutResult.rows[0];

    // ========================================================
    // ALREADY FAILED
    // ========================================================

    if (payout.status === "failed") {
      await client.query("COMMIT");

      return {
        found: true,

        alreadyProcessed: true,

        payout,
      };
    }

    // ========================================================
    // DO NOT REFUND PAID PAYOUT
    // ========================================================

    if (payout.status === "paid") {
      await client.query("COMMIT");

      return {
        found: true,

        alreadyProcessed: true,

        payout,
      };
    }

    // ========================================================
    // LOCK PROVIDER WALLET
    // ========================================================

    const walletResult = await client.query(
      `
      SELECT
        id,
        provider_id,
        available_balance,
        pending_balance,
        total_earned,
        total_withdrawn,
        currency

      FROM provider_wallets

      WHERE provider_id = $1

      FOR UPDATE
      `,
      [payout.provider_id],
    );

    if (walletResult.rows.length === 0) {
      throw new Error("Provider wallet not found while reversing payout");
    }

    const wallet = walletResult.rows[0];

    // ========================================================
    // CHECK EXISTING REFUND
    // ========================================================

    const existingRefund = await client.query(
      `
      SELECT id

      FROM wallet_transactions

      WHERE payout_id = $1

        AND type = 'refund'

      LIMIT 1
      `,
      [payout.id],
    );

    // ========================================================
    // REFUND FULL REQUESTED AMOUNT
    // ========================================================

    if (existingRefund.rows.length === 0) {
      const refundAmount = Number(payout.amount);

      const balanceBefore = Number(wallet.available_balance);

      const balanceAfter = balanceBefore + refundAmount;

      // ------------------------------------------------------
      // RETURN MONEY
      // ------------------------------------------------------

      await client.query(
        `
        UPDATE provider_wallets

        SET
          available_balance =
            available_balance + $1,

          updated_at = NOW()

        WHERE id = $2
        `,
        [refundAmount, wallet.id],
      );

      // ------------------------------------------------------
      // WALLET REFUND TRANSACTION
      // ------------------------------------------------------

      await client.query(
        `
        INSERT INTO wallet_transactions (
          provider_id,
          type,
          amount,
          currency,
          reference,
          description,
          balance_before,
          balance_after,
          payout_id
        )

        VALUES (
          $1,
          'refund',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        `,
        [
          payout.provider_id,

          refundAmount,

          payout.currency,

          `PAYOUT-REFUND-${payout.id}`,

          defaultReason,

          balanceBefore,

          balanceAfter,

          payout.id,
        ],
      );
    }

    // ========================================================
    // FAILURE REASON
    // ========================================================

    const failureReason =
      paystackTransfer.reason || paystackTransfer.failures || defaultReason;

    // ========================================================
    // MARK PAYOUT FAILED
    // ========================================================

    const updatedPayoutResult = await client.query(
      `
      UPDATE payouts

      SET
        status = 'failed',

        failure_reason = $1,

        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        provider_id,
        amount,
        requested_amount,
        withdrawal_fee,
        provider_amount,
        paystack_fee,
        stamp_duty,
        platform_revenue,
        currency,
        status,
        payout_provider,
        provider_reference,
        created_at,
        paid_at,
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        updated_at
      `,
      [String(failureReason), payout.id],
    );

    // ========================================================
    // NOTIFICATION — FAILURE / REVERSAL
    // ========================================================

    const isReversed = defaultReason.toLowerCase().includes("reversed");

    await createNotification({
      userId: payout.provider_id,
      type: isReversed ? "payout_reversed" : "payout_failed",
      title: isReversed ? "Withdrawal reversed" : "Withdrawal failed",
      message: `Your withdrawal of ₦${Number(
        payout.amount,
      ).toLocaleString()} could not be completed. The full amount has been returned to your available balance. Reason: ${String(
        failureReason,
      )}`,
      actionUrl: "/provider/payouts",
      client,
    });

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    return {
      found: true,

      alreadyProcessed: false,

      payout: updatedPayoutResult.rows[0],
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  calculateWithdrawalFee,

  calculatePayoutDetails,

  getProviderWallet,

  createPayout,

  initiatePaystackTransfer,

  handleTransferSuccess,

  handleTransferFailed,

  handleTransferReversed,
};

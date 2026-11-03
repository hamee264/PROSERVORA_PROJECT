const axios = require("axios");
const pool = require("../config/database");

const { createNotification } = require("./notificationService");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// ============================================================
// PAYSTACK HEADERS
// ============================================================

const getPaystackHeaders = () => {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
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
// Supported:
//
// success
// pending
// failed
// reversed
//
// ============================================================

const isMockTransferEnabled = () => {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PAYSTACK_MOCK_TRANSFERS === "true"
  );
};
const getMockTransferStatus = () => {
  const status = String(
    process.env.PAYSTACK_MOCK_TRANSFER_STATUS || "success",
  ).toLowerCase();

  const allowedStatuses = [
    "success",
    "pending",
    "failed",
    "reversed",
  ];

  if (!allowedStatuses.includes(status)) {
    return "success";
  }

  return status;
};

// ============================================================
// WITHDRAWAL FEE
// ============================================================
//
// ₦1 - ₦50,000          → ₦500
// ₦50,001 - ₦100,000    → ₦1,000
// ₦100,001 - ₦200,000   → ₦1,500
// ₦200,001 - ₦500,000   → ₦2,500
// ₦500,001+              → ₦5,000
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

  if (!Number.isInteger(requestedAmount)) {
    const error = new Error(
      "Withdrawal amount must be a whole naira amount",
    );

    error.statusCode = 400;

    throw error;
  }

  const withdrawalFee =
    calculateWithdrawalFee(requestedAmount);

  const providerAmount =
    requestedAmount - withdrawalFee;

  if (providerAmount <= 0) {
    const error = new Error(
      "Withdrawal amount is too small after fees",
    );

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

const getProviderWallet = async (
  providerId,
  client = pool,
) => {
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
    const error = new Error(
      "Provider wallet not found",
    );

    error.statusCode = 404;

    throw error;
  }

  return result.rows[0];
};

// ============================================================
// GET VERIFIED DEFAULT BANK ACCOUNT
// ============================================================

const getVerifiedDefaultBankAccount = async (
  providerId,
  client = pool,
) => {
  const result = await client.query(
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

  if (result.rows.length === 0) {
    const error = new Error(
      "You must add and verify a default bank account before withdrawing",
    );

    error.statusCode = 400;

    throw error;
  }

  return result.rows[0];
};

// ============================================================
// CREATE PAYOUT
// ============================================================
//
// requestedAmount = amount removed from available balance
//
// providerAmount = amount actually sent to provider bank
//
// withdrawalFee = NaijaFix revenue
//
// Example:
//
// Requested:          ₦50,000
// Withdrawal fee:       ₦500
// Provider receives: ₦49,500
//
// Wallet reserves:    ₦50,000
//
// ============================================================

const createPayout = async (
  providerId,
  requestedAmount,
) => {
  const amount = Number(requestedAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error(
      "Invalid withdrawal amount",
    );

    error.statusCode = 400;

    throw error;
  }

  if (!Number.isInteger(amount)) {
    const error = new Error(
      "Withdrawal amount must be a whole naira amount",
    );

    error.statusCode = 400;

    throw error;
  }

  const details =
    calculatePayoutDetails(amount);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // LOCK WALLET
    // ========================================================

    const wallet =
      await getProviderWallet(
        providerId,
        client,
      );

    // ========================================================
    // ONLY NGN
    // ========================================================

    if (wallet.currency !== "NGN") {
      const error = new Error(
        "Only NGN withdrawals are currently supported",
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // CHECK AVAILABLE BALANCE
    // ========================================================

    const availableBalance =
      Number(wallet.available_balance);

    if (
      availableBalance <
      details.requestedAmount
    ) {
      const error = new Error(
        `Insufficient available balance. You need ₦${details.requestedAmount.toLocaleString()} to withdraw this amount.`,
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // GET DEFAULT VERIFIED BANK ACCOUNT
    // ========================================================

    const bankAccount =
      await getVerifiedDefaultBankAccount(
        providerId,
        client,
      );

    // ========================================================
    // PAYSTACK RECIPIENT CODE
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

    const balanceBefore =
      availableBalance;

    const balanceAfter =
      balanceBefore -
      details.requestedAmount;

    // ========================================================
    // RESERVE FULL REQUESTED AMOUNT
    // ========================================================

    const walletResult =
      await client.query(
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
        [
          details.requestedAmount,
          wallet.id,
        ],
      );

    if (
      walletResult.rows.length === 0
    ) {
      const error = new Error(
        "Unable to reserve withdrawal amount",
      );

      error.statusCode = 409;

      throw error;
    }

    const updatedWallet =
      walletResult.rows[0];

    // ========================================================
    // CREATE PAYOUT
    // ========================================================

    const payoutResult =
      await client.query(
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

    const payout =
      payoutResult.rows[0];

    // ========================================================
    // WALLET RESERVATION TRANSACTION
    // ========================================================

    const transactionResult =
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
    // NOTIFICATION
    // ========================================================

    await createNotification({
      userId: providerId,

      type: "payout_requested",

      title:
        "Withdrawal request submitted",

      message: `Your withdrawal request for ₦${details.requestedAmount.toLocaleString()} has been submitted. You will receive ₦${details.providerAmount.toLocaleString()} after the ₦${details.withdrawalFee.toLocaleString()} withdrawal fee.`,

      actionUrl:
        "/provider/payouts",

      client,
    });

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    return {
      payout,

      wallet: updatedWallet,

      walletTransaction:
        transactionResult.rows[0],

      requestedAmount:
        details.requestedAmount,

      withdrawalFee:
        details.withdrawalFee,

      providerAmount:
        details.providerAmount,

      platformRevenue:
        details.platformRevenue,

      bankAccount: {
        id: bankAccount.id,
        bankName:
          bankAccount.bank_name,
        accountName:
          bankAccount.account_name,
        accountNumber:
          bankAccount.account_number,
        recipientCode:
          bankAccount.recipient_code,
      },
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Payout rollback error:",
        rollbackError,
      );
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
// Important:
//
// 1. Payout is moved to processing before Paystack.
// 2. DB transaction is committed before Paystack is called.
// 3. Network/timeout/5xx does NOT refund automatically.
// 4. A deterministic reference is always used.
// 5. Webhook is the final authority.
//
// ============================================================

const initiatePaystackTransfer = async (
  payoutId,
) => {
  const client = await pool.connect();

  let payout;
  let providerAmount;
  let reference;

  try {
    await client.query("BEGIN");

    // ========================================================
    // LOCK PAYOUT
    // ========================================================

    const payoutResult =
      await client.query(
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
      const error = new Error(
        "Payout not found",
      );

      error.statusCode = 404;

      throw error;
    }

    payout =
      payoutResult.rows[0];

    // ========================================================
    // ALREADY PROCESSING
    // ========================================================

    if (payout.status === "processing") {
      await client.query("COMMIT");

      return {
        payout,

        alreadyInitiated: true,
      };
    }

    // ========================================================
    // ALREADY PAID
    // ========================================================

    if (payout.status === "paid") {
      await client.query("COMMIT");

      return {
        payout,

        alreadyInitiated: true,
      };
    }

    // ========================================================
    // ONLY PENDING
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

    providerAmount =
      Number(payout.provider_amount);

    if (
      !Number.isFinite(providerAmount) ||
      providerAmount <= 0
    ) {
      const error = new Error(
        "Invalid provider payout amount",
      );

      error.statusCode = 400;

      throw error;
    }

    // ========================================================
    // PAYSTACK REFERENCE
    // ========================================================

    reference =
      `nf_payout_${payout.id}`;

    // ========================================================
    // MARK PROCESSING
    // ========================================================

    const processingResult =
      await client.query(
        `
        UPDATE payouts

        SET
          status = 'processing',

          provider_reference = $1,

          processed_at =
            COALESCE(
              processed_at,
              NOW()
            ),

          failure_reason = NULL,

          updated_at = NOW()

        WHERE id = $2

          AND status = 'pending'

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
          reference,
          payout.id,
        ],
      );

    if (
      processingResult.rows.length === 0
    ) {
      const error = new Error(
        "Unable to move payout into processing state",
      );

      error.statusCode = 409;

      throw error;
    }

    payout =
      processingResult.rows[0];

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Payout initiation rollback error:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }

  // ==========================================================
  // MOCK PAYSTACK
  // ==========================================================

  if (isMockTransferEnabled()) {
    const mockResult =
      getMockTransferStatus();

    console.log("");
    console.log(
      "============================================",
    );
    console.log(
      "🧪 MOCK PAYSTACK TRANSFER",
    );
    console.log(
      "============================================",
    );
    console.log(
      "Payout ID:",
      payout.id,
    );
    console.log(
      "Provider:",
      payout.provider_id,
    );
    console.log(
      "Amount:",
      `₦${providerAmount.toLocaleString()}`,
    );
    console.log(
      "Result:",
      mockResult,
    );
    console.log(
      "============================================",
    );
    console.log("");

    const mockTransfer = {
      reference,

      transferCode:
        `MOCK_TRANSFER_${payout.id}`,

      status:
        mockResult === "success"
          ? "success"
          : mockResult,

      amount:
        Math.round(
          providerAmount * 100,
        ),

      currency:
        payout.currency,
    };

    if (
      mockResult === "success"
    ) {
      const successResult =
        await handleTransferSuccess(
          mockTransfer,
        );

      return {
        payout:
          successResult.payout,

        paystack:
          mockTransfer,

        alreadyInitiated: false,

        mock: true,
      };
    }

    if (
      mockResult === "failed"
    ) {
      const failureResult =
        await handleTransferFailed({
          ...mockTransfer,

          reason:
            "Mock Paystack transfer failed",
        });

      return {
        payout:
          failureResult.payout,

        wallet:
          failureResult.wallet || null,

        paystack:
          mockTransfer,

        alreadyInitiated: false,

        failed: true,

        mock: true,
      };
    }

    if (
      mockResult === "reversed"
    ) {
      const reversalResult =
        await handleTransferReversed({
          ...mockTransfer,

          reason:
            "Mock Paystack transfer reversed",
        });

      return {
        payout:
          reversalResult.payout,

        wallet:
          reversalResult.wallet || null,

        paystack:
          mockTransfer,

        alreadyInitiated: false,

        failed: true,

        mock: true,
      };
    }

    return {
      payout,

      paystack:
        mockTransfer,

      alreadyInitiated: false,

      uncertain: true,

      mock: true,
    };
  }

  // ==========================================================
  // REAL PAYSTACK TRANSFER
  // ==========================================================

  let paystackResponse;

  try {
    paystackResponse =
      await axios.post(
        `${PAYSTACK_BASE_URL}/transfer`,
        {
          source: "balance",

          amount:
            Math.round(
              providerAmount * 100,
            ),

          recipient:
            payout.recipient_code,

          reference,

          reason:
            "NaijaFix provider withdrawal",

          currency:
            payout.currency,
        },
        {
          headers:
            getPaystackHeaders(),

          timeout: 30000,
        },
      );
  } catch (error) {
    console.error(
      "Paystack payout initiation error:",
      error.response?.data ||
      error.message,
    );

    const status =
      error.response?.status;

    // ========================================================
    // DEFINITIVE HTTP REJECTION
    // ========================================================

    if (
      status &&
      status >= 400 &&
      status < 500
    ) {
      const failureReason =
        error.response?.data?.message ||
        "Paystack rejected the transfer request";

      const client =
        await pool.connect();

      try {
        await client.query("BEGIN");

        const payoutResult =
          await client.query(
            `
            SELECT
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
              bank_account_id,
              recipient_code,
              failure_reason,
              processed_at,
              created_at,
              paid_at,
              updated_at

            FROM payouts

            WHERE id = $1

            FOR UPDATE
            `,
            [payout.id],
          );

        if (
          payoutResult.rows.length === 0
        ) {
          throw new Error(
            "Payout disappeared while processing Paystack rejection",
          );
        }

        const currentPayout =
          payoutResult.rows[0];

        if (
          currentPayout.status ===
          "processing"
        ) {
          const result =
            await restoreFailedPayoutFunds(
              currentPayout,
              failureReason,
              client,
            );

          await client.query("COMMIT");

          return {
            payout:
              result.payout,

            wallet:
              result.wallet,

            walletTransaction:
              result.walletTransaction,

            failed: true,

            alreadyInitiated: false,

            message:
              "Paystack rejected the withdrawal and the reserved funds were returned.",
          };
        }

        await client.query("COMMIT");

        return {
          payout:
            currentPayout,

          failed:
            currentPayout.status ===
            "failed",

          alreadyInitiated: false,

          message:
            "Paystack rejected the withdrawal.",
        };
      } catch (refundError) {
        try {
          await client.query(
            "ROLLBACK",
          );
        } catch (rollbackError) {
          console.error(
            "Paystack rejection rollback error:",
            rollbackError,
          );
        }

        throw refundError;
      } finally {
        client.release();
      }
    }

    // ========================================================
    // NETWORK / TIMEOUT / 5XX
    // ========================================================

    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE payouts

        SET
          failure_reason = $1,

          updated_at = NOW()

        WHERE id = $2

          AND status = 'processing'
        `,
        [
          `Paystack transfer initiation response was uncertain: ${error.message ||
          "Unknown network error"
          }`,
          payout.id,
        ],
      );

      await createNotification({
        userId:
          payout.provider_id,

        type:
          "payout_processing",

        title:
          "Withdrawal is being verified",

        message: `Your withdrawal of ₦${Number(
          payout.requested_amount,
        ).toLocaleString()} has been sent for processing. We are waiting for Paystack to confirm the transfer.`,

        actionUrl:
          "/provider/payouts",

        client,
      });

      await client.query("COMMIT");
    } catch (uncertainError) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (rollbackError) {
        console.error(
          "Uncertain payout rollback error:",
          rollbackError,
        );
      }

      throw uncertainError;
    } finally {
      client.release();
    }

    return {
      payout,

      paystack: {
        reference,

        status: "processing",

        amount:
          Math.round(
            providerAmount * 100,
          ),

        currency:
          payout.currency,
      },

      alreadyInitiated: false,

      uncertain: true,

      mock: false,
    };
  }

  // ==========================================================
  // PAYSTACK RESPONSE VALIDATION
  // ==========================================================

  if (
    !paystackResponse.data ||
    paystackResponse.data.status !==
    true ||
    !paystackResponse.data.data
  ) {
    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE payouts

        SET
          failure_reason = $1,

          updated_at = NOW()

        WHERE id = $2

          AND status = 'processing'
        `,
        [
          "Paystack returned an uncertain transfer response",
          payout.id,
        ],
      );

      await createNotification({
        userId:
          payout.provider_id,

        type:
          "payout_processing",

        title:
          "Withdrawal is being verified",

        message: `Your withdrawal of ₦${Number(
          payout.requested_amount,
        ).toLocaleString()} is being verified with Paystack.`,

        actionUrl:
          "/provider/payouts",

        client,
      });

      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (rollbackError) {
        console.error(
          "Payout response rollback error:",
          rollbackError,
        );
      }

      throw error;
    } finally {
      client.release();
    }

    return {
      payout,

      paystack: {
        reference,

        status: "processing",

        amount:
          Math.round(
            providerAmount * 100,
          ),

        currency:
          payout.currency,
      },

      alreadyInitiated: false,

      uncertain: true,

      mock: false,
    };
  }

  // ==========================================================
  // PAYSTACK TRANSFER
  // ==========================================================

  const transfer =
    paystackResponse.data.data;

  // ==========================================================
  // REFERENCE VALIDATION
  // ==========================================================

  if (
    !transfer.reference ||
    transfer.reference !== reference
  ) {
    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE payouts

        SET
          failure_reason = $1,

          updated_at = NOW()

        WHERE id = $2

          AND status = 'processing'
        `,
        [
          !transfer.reference
            ? "Paystack returned a transfer without a reference"
            : "Paystack returned a transfer reference mismatch",
          payout.id,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (rollbackError) {
        console.error(
          "Reference validation rollback error:",
          rollbackError,
        );
      }

      throw error;
    } finally {
      client.release();
    }

    return {
      payout,

      uncertain: true,

      alreadyInitiated: false,

      paystack: {
        reference,

        status: "processing",

        amount:
          transfer.amount,

        currency:
          transfer.currency,
      },
    };
  }

  // ==========================================================
  // AMOUNT / CURRENCY VALIDATION
  // ==========================================================

  try {
    validatePaystackTransferPayload(
      {
        ...payout,

        provider_reference:
          reference,
      },
      transfer,
    );
  } catch (validationError) {
    console.error(
      "Paystack payout initiation validation error:",
      validationError,
    );

    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      const payoutResult =
        await client.query(
          `
          SELECT
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
            bank_account_id,
            recipient_code,
            failure_reason,
            processed_at,
            created_at,
            paid_at,
            updated_at

          FROM payouts

          WHERE id = $1

          FOR UPDATE
          `,
          [payout.id],
        );

      if (
        payoutResult.rows.length === 0
      ) {
        throw new Error(
          "Payout not found after Paystack response",
        );
      }

      const currentPayout =
        payoutResult.rows[0];

      await client.query(
        `
        UPDATE payouts

        SET
          failure_reason = $1,

          updated_at = NOW()

        WHERE id = $2

          AND status = 'processing'
        `,
        [
          validationError.message,
          payout.id,
        ],
      );

      await client.query("COMMIT");

      return {
        payout:
          currentPayout,

        uncertain: true,

        alreadyInitiated: false,

        paystack: {
          reference,

          status: "processing",

          amount:
            transfer.amount,

          currency:
            transfer.currency,
        },
      };
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (rollbackError) {
        console.error(
          "Paystack validation rollback error:",
          rollbackError,
        );
      }

      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================================
  // RETURN PROCESSING PAYOUT
  // ==========================================================
  //
  // The webhook remains the final authority.
  //
  // ==========================================================

  return {
    payout,

    paystack: {
      reference:
        transfer.reference,

      transferCode:
        transfer.transfer_code,

      status:
        transfer.status,

      amount:
        transfer.amount,

      currency:
        transfer.currency,
    },

    alreadyInitiated: false,

    uncertain: false,

    mock: false,
  };
};

// ============================================================
// RESTORE FAILED PAYOUT FUNDS
// ============================================================
//
// ONLY used when the transfer failure is definitive.
//
// Restores the FULL requested payout amount.
//
// Idempotent through:
//
// PAYOUT-REFUND-{payout.id}
//
// ============================================================

const restoreFailedPayoutFunds = async (
  payout,
  failureReason,
  client,
) => {
  // ========================================================
  // LOCK WALLET
  // ========================================================

  const walletResult =
    await client.query(
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
    throw new Error(
      "Provider wallet not found while restoring payout funds",
    );
  }

  const wallet =
    walletResult.rows[0];

  // ========================================================
  // DETERMINISTIC REFUND REFERENCE
  // ========================================================

  const refundReference =
    `PAYOUT-REFUND-${payout.id}`;

  // ========================================================
  // CHECK EXISTING REFUND TRANSACTION
  // ========================================================

  const existingRefund =
    await client.query(
      `
      SELECT
        id,
        amount,
        balance_before,
        balance_after,
        created_at

      FROM wallet_transactions

      WHERE payout_id = $1

        AND reference = $2

      LIMIT 1
      `,
      [
        payout.id,
        refundReference,
      ],
    );

  // ========================================================
  // ALREADY RESTORED
  // ========================================================

  if (
    existingRefund.rows.length > 0
  ) {
    return {
      alreadyRestored: true,

      wallet,

      walletTransaction:
        existingRefund.rows[0],
    };
  }

  // ========================================================
  // FULL REQUESTED AMOUNT
  // ========================================================

  const refundAmount =
    Number(payout.amount);

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    throw new Error(
      "Invalid payout amount while restoring funds",
    );
  }

  const balanceBefore =
    Number(wallet.available_balance);

  const balanceAfter =
    balanceBefore + refundAmount;

  // ========================================================
  // RESTORE WALLET
  // ========================================================

  const updatedWalletResult =
    await client.query(
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
      [
        refundAmount,
        wallet.id,
      ],
    );

  if (
    updatedWalletResult.rows.length === 0
  ) {
    throw new Error(
      "Unable to restore payout funds",
    );
  }

  // ========================================================
  // WALLET REFUND TRANSACTION
  // ========================================================

  const transactionResult =
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
        payout.provider_id,

        refundAmount,

        payout.currency,

        refundReference,

        `Withdrawal returned because Paystack transfer failed: ${String(
          failureReason,
        )}`,

        balanceBefore,

        balanceAfter,

        payout.id,
      ],
    );

  // ========================================================
  // MARK PAYOUT FAILED
  // ========================================================

  const updatedPayoutResult =
    await client.query(
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
      [
        String(failureReason),
        payout.id,
      ],
    );

  // ========================================================
  // NOTIFICATION
  // ========================================================

  await createNotification({
    userId:
      payout.provider_id,

    type:
      "payout_failed",

    title:
      "Withdrawal failed",

    message: `Your withdrawal of ₦${refundAmount.toLocaleString()} could not be completed. The full amount has been returned to your available balance. Reason: ${String(
      failureReason,
    )}`,

    actionUrl:
      "/provider/payouts",

    client,
  });

  return {
    alreadyRestored: false,

    payout:
      updatedPayoutResult.rows[0],

    wallet:
      updatedWalletResult.rows[0],

    walletTransaction:
      transactionResult.rows[0],
  };
};

// ============================================================
// HANDLE TRANSFER SUCCESS
// ============================================================

const handleTransferSuccess = async (
  paystackTransfer,
) => {
  // ========================================================
  // BASIC PAYLOAD VALIDATION
  // ========================================================

  if (
    !paystackTransfer ||
    typeof paystackTransfer !== "object"
  ) {
    const error = new Error(
      "Invalid Paystack transfer payload",
    );

    error.statusCode = 400;

    throw error;
  }

  const reference =
    paystackTransfer.reference;

  if (!reference) {
    const error = new Error(
      "Paystack transfer reference is missing",
    );

    error.statusCode = 400;

    throw error;
  }

  // ========================================================
  // SUCCESS STATUS VALIDATION
  // ========================================================

  if (
    String(
      paystackTransfer.status || "",
    ).toLowerCase() !== "success"
  ) {
    const error = new Error(
      "Paystack transfer success webhook has an invalid status",
    );

    error.statusCode = 400;

    throw error;
  }

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // FIND PAYOUT
    // ========================================================

    const payoutResult =
      await client.query(
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

    if (
      payoutResult.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK",
      );

      console.warn(
        "Received Paystack transfer.success for unknown payout:",
        reference,
      );

      return {
        found: false,
      };
    }

    const payout =
      payoutResult.rows[0];

    // ========================================================
    // VALIDATE PAYLOAD AGAINST PAYOUT
    // ========================================================

    validatePaystackTransferPayload(
      payout,
      paystackTransfer,
    );

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
    // DO NOT PAY FAILED PAYOUT
    // ========================================================

    if (payout.status === "failed") {
      await client.query("COMMIT");

      console.warn(
        "Received transfer.success for failed payout:",
        payout.id,
      );

      return {
        found: true,

        alreadyProcessed: true,

        payout,
      };
    }

    // ========================================================
    // ONLY PROCESS PROCESSING PAYOUT
    // ========================================================

    if (
      payout.status !==
      "processing"
    ) {
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

    const updatedPayoutResult =
      await client.query(
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

          AND status = 'processing'

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

    if (
      updatedPayoutResult.rows.length === 0
    ) {
      throw new Error(
        "Unable to mark payout as paid",
      );
    }

    // ========================================================
    // UPDATE TOTAL WITHDRAWN
    // ========================================================
    //
    // amount = FULL REQUESTED AMOUNT.
    //
    // ========================================================

    const walletResult =
      await client.query(
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
        [
          payout.amount,
          payout.provider_id,
        ],
      );

    if (
      walletResult.rows.length === 0
    ) {
      throw new Error(
        "Provider wallet not found while completing payout",
      );
    }

    // ========================================================
    // SUCCESS NOTIFICATION
    // ========================================================

    await createNotification({
      userId:
        payout.provider_id,

      type:
        "payout_paid",

      title:
        "Withdrawal successful",

      message: `Your withdrawal of ₦${Number(
        payout.requested_amount,
      ).toLocaleString()} has been completed successfully. ₦${Number(
        payout.provider_amount,
      ).toLocaleString()} has been sent to your bank account.`,

      actionUrl:
        "/provider/payouts",

      client,
    });

    await client.query("COMMIT");

    return {
      found: true,

      alreadyProcessed: false,

      payout:
        updatedPayoutResult.rows[0],

      wallet:
        walletResult.rows[0],
    };
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      );
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// HANDLE TRANSFER FAILED
// ============================================================

const handleTransferFailed = async (
  paystackTransfer,
) => {
  if (
    !paystackTransfer ||
    typeof paystackTransfer !== "object"
  ) {
    const error = new Error(
      "Invalid Paystack transfer payload",
    );

    error.statusCode = 400;

    throw error;
  }

  const status =
    String(
      paystackTransfer.status || "",
    ).toLowerCase();

  if (
    status &&
    status !== "failed"
  ) {
    const error = new Error(
      "Paystack transfer failed webhook has an invalid status",
    );

    error.statusCode = 400;

    throw error;
  }

  return handleTransferFailure(
    paystackTransfer,
    "Paystack transfer failed",
  );
};

// ============================================================
// HANDLE TRANSFER REVERSED
// ============================================================

const handleTransferReversed = async (
  paystackTransfer,
) => {
  if (
    !paystackTransfer ||
    typeof paystackTransfer !== "object"
  ) {
    const error = new Error(
      "Invalid Paystack transfer payload",
    );

    error.statusCode = 400;

    throw error;
  }

  const status =
    String(
      paystackTransfer.status || "",
    ).toLowerCase();

  if (
    status &&
    status !== "reversed"
  ) {
    const error = new Error(
      "Paystack transfer reversed webhook has an invalid status",
    );

    error.statusCode = 400;

    throw error;
  }

  return handleTransferFailure(
    paystackTransfer,
    "Paystack transfer was reversed",
  );
};

// ============================================================
// HANDLE TRANSFER FAILURE / REVERSAL
// ============================================================

const handleTransferFailure = async (
  paystackTransfer,
  defaultReason,
) => {
  const reference =
    paystackTransfer.reference;

  if (!reference) {
    const error = new Error(
      "Paystack transfer reference is missing",
    );

    error.statusCode = 400;

    throw error;
  }

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // FIND PAYOUT
    // ========================================================

    const payoutResult =
      await client.query(
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

    if (
      payoutResult.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK",
      );

      console.warn(
        "Received Paystack transfer failure for unknown payout:",
        reference,
      );

      return {
        found: false,
      };
    }

    const payout =
      payoutResult.rows[0];

    // ========================================================
    // VALIDATE PAYLOAD
    // ========================================================

    validatePaystackTransferPayload(
      payout,
      paystackTransfer,
    );

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
    // ALREADY PAID
    // ========================================================

    if (payout.status === "paid") {
      await client.query("COMMIT");

      console.warn(
        "Received transfer failure for already-paid payout:",
        payout.id,
      );

      return {
        found: true,

        alreadyProcessed: true,

        payout,
      };
    }

    // ========================================================
    // ONLY PROCESS PROCESSING PAYOUT
    // ========================================================

    if (
      payout.status !==
      "processing"
    ) {
      await client.query("COMMIT");

      return {
        found: true,

        alreadyProcessed: false,

        payout,
      };
    }

    // ========================================================
    // LOCK WALLET
    // ========================================================

    const walletResult =
      await client.query(
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

    if (
      walletResult.rows.length === 0
    ) {
      throw new Error(
        "Provider wallet not found while reversing payout",
      );
    }

    const wallet =
      walletResult.rows[0];

    // ========================================================
    // DETERMINISTIC REFUND REFERENCE
    // ========================================================

    const refundReference =
      `PAYOUT-REFUND-${payout.id}`;

    // ========================================================
    // CHECK EXISTING REFUND
    // ========================================================

    const existingRefund =
      await client.query(
        `
        SELECT
          id,
          amount,
          balance_before,
          balance_after,
          created_at

        FROM wallet_transactions

        WHERE payout_id = $1

          AND reference = $2

        LIMIT 1
        `,
        [
          payout.id,
          refundReference,
        ],
      );

    let refundTransaction =
      null;

    // ========================================================
    // RESTORE ONLY ONCE
    // ========================================================

    if (
      existingRefund.rows.length ===
      0
    ) {
      const refundAmount =
        Number(payout.amount);

      if (
        !Number.isFinite(
          refundAmount,
        ) ||
        refundAmount <= 0
      ) {
        throw new Error(
          "Invalid payout amount while reversing payout",
        );
      }

      const balanceBefore =
        Number(
          wallet.available_balance,
        );

      const balanceAfter =
        balanceBefore +
        refundAmount;

      // ------------------------------------------------------
      // RESTORE WALLET
      // ------------------------------------------------------

      const updatedWalletResult =
        await client.query(
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
          [
            refundAmount,
            wallet.id,
          ],
        );

      if (
        updatedWalletResult.rows
          .length === 0
      ) {
        throw new Error(
          "Unable to restore payout funds",
        );
      }

      // ------------------------------------------------------
      // WALLET REFUND TRANSACTION
      // ------------------------------------------------------

      const transactionResult =
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
            payout.provider_id,

            refundAmount,

            payout.currency,

            refundReference,

            defaultReason,

            balanceBefore,

            balanceAfter,

            payout.id,
          ],
        );

      refundTransaction =
        transactionResult.rows[0];
    } else {
      refundTransaction =
        existingRefund.rows[0];
    }

    // ========================================================
    // FAILURE REASON
    // ========================================================

    const failureReason =
      paystackTransfer.reason ||
      paystackTransfer.failures ||
      defaultReason;

    // ========================================================
    // MARK PAYOUT FAILED
    // ========================================================

    const updatedPayoutResult =
      await client.query(
        `
        UPDATE payouts

        SET
          status = 'failed',

          failure_reason = $1,

          updated_at = NOW()

        WHERE id = $2

        AND status = 'processing'

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
          String(failureReason),
          payout.id,
        ],
      );

    if (
      updatedPayoutResult.rows.length ===
      0
    ) {
      throw new Error(
        "Unable to mark failed payout",
      );
    }

    // ========================================================
    // FAILURE / REVERSAL NOTIFICATION
    // ========================================================

    const isReversed =
      defaultReason
        .toLowerCase()
        .includes("reversed");

    await createNotification({
      userId:
        payout.provider_id,

      type: isReversed
        ? "payout_reversed"
        : "payout_failed",

      title: isReversed
        ? "Withdrawal reversed"
        : "Withdrawal failed",

      message: `Your withdrawal of ₦${Number(
        payout.amount,
      ).toLocaleString()} could not be completed. The full amount has been returned to your available balance. Reason: ${String(
        failureReason,
      )}`,

      actionUrl:
        "/provider/payouts",

      client,
    });

    // ========================================================
    // COMMIT
    // ========================================================

    await client.query("COMMIT");

    return {
      found: true,

      alreadyProcessed: false,

      payout:
        updatedPayoutResult.rows[0],

      wallet:
        walletResult.rows[0],

      walletTransaction:
        refundTransaction,
    };
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      );
    } catch (rollbackError) {
      console.error(
        "Rollback error:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// GET PROVIDER PAYOUTS
// ============================================================

const getProviderPayouts = async (
  providerId,
) => {
  const result =
    await pool.query(
      `
      SELECT
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
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        created_at,
        paid_at,
        updated_at

      FROM payouts

      WHERE provider_id = $1

      ORDER BY created_at DESC
      `,
      [providerId],
    );

  return result.rows;
};

// ============================================================
// GET PROVIDER PAYOUT
// ============================================================

const getProviderPayout = async (
  providerId,
  payoutId,
) => {
  const result =
    await pool.query(
      `
      SELECT
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
        bank_account_id,
        recipient_code,
        failure_reason,
        processed_at,
        created_at,
        paid_at,
        updated_at

      FROM payouts

      WHERE id = $1

        AND provider_id = $2

      LIMIT 1
      `,
      [
        payoutId,
        providerId,
      ],
    );

  if (result.rows.length === 0) {
    const error = new Error(
      "Payout not found",
    );

    error.statusCode = 404;

    throw error;
  }

  return result.rows[0];
};

// ============================================================
// VALIDATE PAYSTACK TRANSFER PAYLOAD
// ============================================================

const validatePaystackTransferPayload = (
  payout,
  transfer,
) => {
  if (
    !transfer ||
    typeof transfer !== "object"
  ) {
    const error = new Error(
      "Invalid Paystack transfer payload",
    );

    error.statusCode = 400;

    throw error;
  }

  // ========================================================
  // REFERENCE
  // ========================================================

  if (!transfer.reference) {
    const error = new Error(
      "Paystack transfer reference is missing",
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    payout.provider_reference &&
    transfer.reference !==
    payout.provider_reference
  ) {
    const error = new Error(
      "Paystack transfer reference mismatch",
    );

    error.statusCode = 400;

    throw error;
  }

  // ========================================================
  // CURRENCY
  // ========================================================

  const payoutCurrency =
    String(
      payout.currency || "",
    ).toUpperCase();

  const transferCurrency =
    String(
      transfer.currency || "",
    ).toUpperCase();

  if (
    !transferCurrency ||
    transferCurrency !==
    payoutCurrency
  ) {
    const error = new Error(
      "Paystack transfer currency mismatch",
    );

    error.statusCode = 400;

    throw error;
  }

  // ========================================================
  // AMOUNT
  // ========================================================

  const expectedAmount =
    Math.round(
      Number(
        payout.provider_amount,
      ) * 100,
    );

  const receivedAmount =
    Number(transfer.amount);

  if (
    !Number.isFinite(
      receivedAmount,
    ) ||
    receivedAmount !==
    expectedAmount
  ) {
    const error = new Error(
      "Paystack transfer amount mismatch",
    );

    error.statusCode = 400;

    throw error;
  }

  return true;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  calculateWithdrawalFee,
  calculatePayoutDetails,
  getProviderWallet,
  getProviderPayouts,
  getProviderPayout,
  createPayout,
  initiatePaystackTransfer,
  handleTransferSuccess,
  handleTransferFailed,
  handleTransferReversed,
};
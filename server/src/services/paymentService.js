const axios = require("axios");
const pool = require("../config/database");
const notificationService = require("./notificationService");

// ============================================================
// SAFE NOTIFICATION HELPER
// ============================================================
// Notification failure must NEVER break a successful
// payment/release operation.
//
// The financial database transaction is already committed
// before this helper is called.
// ============================================================

const sendNotification = async ({
  userId,
  type,
  title,
  message,
  actionUrl = null,
}) => {
  try {
    await notificationService.createNotification({
      userId,
      type,
      title,
      message,
      actionUrl,
    });
  } catch (error) {
    console.error("Payment notification error:", error);
  }
};

// ============================================================
// PLATFORM FEE
// ============================================================

const calculatePlatformFee = (amount) => {
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
// PAYMENT STATUS HELPERS
// ============================================================

const isCompletedPayment = (status) => {
  return ["paid", "held", "released"].includes(status);
};

// ============================================================
// GET BOOKING PAYMENT DETAILS
// ============================================================

const getBookingPaymentDetails = async (customerId, bookingId) => {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.customer_id,
      b.provider_id,
      b.agreed_amount,
      b.currency,
      b.status,

      o.title AS opportunity_title,

      u.email AS customer_email

    FROM bookings b

    INNER JOIN opportunities o
      ON o.id = b.opportunity_id

    INNER JOIN users u
      ON u.id = b.customer_id

    WHERE b.id = $1
      AND b.customer_id = $2
    `,
    [bookingId, customerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = result.rows[0];

  // ----------------------------------------------------------
  // BOOKING MUST BE COMPLETED
  // ----------------------------------------------------------

  if (booking.status !== "completed") {
    const error = new Error(
      "Payment can only be made after the job has been completed",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXISTING PAYMENT
  // ----------------------------------------------------------

  const paymentResult = await pool.query(
    `
    SELECT
      id,
      booking_id,
      customer_id,
      provider_id,
      amount,
      currency,
      platform_fee,
      processing_fee,
      customer_total,
      provider_amount,
      payment_provider,
      provider_transaction_id,
      status,
      paid_at,
      released_at,
      refunded_at,
      created_at,
      updated_at

    FROM payments

    WHERE booking_id = $1

    ORDER BY created_at DESC

    LIMIT 1
    `,
    [bookingId],
  );

  // ----------------------------------------------------------
  // EXISTING PAYMENT
  // ----------------------------------------------------------

  if (paymentResult.rows.length > 0) {
    const existingPayment = paymentResult.rows[0];

    if (isCompletedPayment(existingPayment.status)) {
      const error = new Error("This booking has already been paid for");

      error.statusCode = 400;
      throw error;
    }

    return {
      booking,
      payment: existingPayment,
    };
  }

  // ----------------------------------------------------------
  // CALCULATE PAYMENT
  // ----------------------------------------------------------

  const bookingAmount = Number(booking.agreed_amount);

  const platformFee = calculatePlatformFee(bookingAmount);

  const processingFee = 0;

  const customerTotal = bookingAmount + platformFee + processingFee;

  const providerAmount = bookingAmount;

  return {
    booking,

    payment: {
      bookingAmount,
      bookingCurrency: booking.currency,
      platformFee,
      processingFee,
      customerTotal,
      providerAmount,
    },
  };
};

// ============================================================
// INITIALIZE PAYSTACK TRANSACTION
// ============================================================

const initializePaystackTransaction = async ({ payment, booking }) => {
  const amountInSubunit = Math.round(Number(payment.customer_total) * 100);

  const reference = `NF-${payment.id}`;

  let paystackResponse;

  try {
    paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: booking.customer_email,

        amount: amountInSubunit,

        currency: booking.currency,

        reference,

        metadata: {
          payment_id: payment.id,
          booking_id: booking.id,
          customer_id: booking.customer_id,
          provider_id: booking.provider_id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message,
    );

    throw Object.assign(
      new Error(
        error.response?.data?.message ||
          "Unable to initialize Paystack payment",
      ),
      {
        statusCode: 502,
      },
    );
  }

  // ----------------------------------------------------------
  // CHECK PAYSTACK RESPONSE
  // ----------------------------------------------------------

  if (
    !paystackResponse.data ||
    !paystackResponse.data.status ||
    !paystackResponse.data.data
  ) {
    throw Object.assign(
      new Error("Paystack failed to initialize the transaction"),
      {
        statusCode: 502,
      },
    );
  }

  const paystackData = paystackResponse.data.data;

  // ----------------------------------------------------------
  // SAVE PAYSTACK REFERENCE
  // ----------------------------------------------------------

  const updatedPaymentResult = await pool.query(
    `
    UPDATE payments

    SET
      provider_transaction_id = $1,
      updated_at = NOW()

    WHERE id = $2

    RETURNING
      id,
      booking_id,
      customer_id,
      provider_id,
      amount,
      currency,
      platform_fee,
      processing_fee,
      customer_total,
      provider_amount,
      payment_provider,
      provider_transaction_id,
      status,
      paid_at,
      released_at,
      refunded_at,
      created_at,
      updated_at
    `,
    [paystackData.reference, payment.id],
  );

  if (updatedPaymentResult.rows.length === 0) {
    throw Object.assign(
      new Error("Unable to save Paystack payment reference"),
      {
        statusCode: 500,
      },
    );
  }

  return {
    payment: updatedPaymentResult.rows[0],

    paystack: {
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference: paystackData.reference,
    },
  };
};

// ============================================================
// CREATE PAYMENT + INITIALIZE PAYSTACK
// ============================================================

const createPayment = async (
  customerId,
  bookingId,
  paymentProvider = "paystack",
) => {
  const details = await getBookingPaymentDetails(customerId, bookingId);

  const { booking, payment } = details;

  // ----------------------------------------------------------
  // ONLY PAYSTACK FOR NOW
  // ----------------------------------------------------------

  if (paymentProvider !== "paystack") {
    const error = new Error("Only Paystack payments are currently supported");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // EXISTING PAYMENT
  // ----------------------------------------------------------

  if (payment.id) {
    if (isCompletedPayment(payment.status)) {
      const error = new Error("This booking has already been paid for");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // EXISTING PAYSTACK REFERENCE
    // --------------------------------------------------------

    if (payment.provider_transaction_id) {
      return {
        booking,

        payment,

        paystack: {
          reference: payment.provider_transaction_id,
        },
      };
    }
  }

  // ----------------------------------------------------------
  // CREATE PAYMENT IF IT DOES NOT EXIST
  // ----------------------------------------------------------

  let createdPayment;

  if (!payment.id) {
    const paymentResult = await pool.query(
      `
      INSERT INTO payments (
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        status
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        'pending'
      )

      RETURNING
        id,
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        provider_transaction_id,
        status,
        paid_at,
        released_at,
        refunded_at,
        created_at,
        updated_at
      `,
      [
        booking.id,
        booking.customer_id,
        booking.provider_id,
        payment.bookingAmount,
        payment.bookingCurrency,
        payment.platformFee,
        payment.processingFee,
        payment.customerTotal,
        payment.providerAmount,
        paymentProvider,
      ],
    );

    createdPayment = paymentResult.rows[0];
  } else {
    createdPayment = payment;
  }

  // ----------------------------------------------------------
  // PAYSTACK AMOUNT
  // ----------------------------------------------------------

  const amountInKobo = Math.round(Number(createdPayment.customer_total) * 100);

  // ----------------------------------------------------------
  // UNIQUE REFERENCE
  // ----------------------------------------------------------

  const reference = `NF-${createdPayment.id}`;

  // ----------------------------------------------------------
  // INITIALIZE PAYSTACK
  // ----------------------------------------------------------

  let paystackResponse;

  try {
    paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: booking.customer_email,

        amount: amountInKobo,

        currency: booking.currency,

        reference,

        metadata: {
          payment_id: createdPayment.id,
          booking_id: booking.id,
          customer_id: booking.customer_id,
          provider_id: booking.provider_id,
          booking_amount: createdPayment.amount,
          platform_fee: createdPayment.platform_fee,
          customer_total: createdPayment.customer_total,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message,
    );

    await pool.query(
      `
      UPDATE payments

      SET
        status = 'failed',
        updated_at = NOW()

      WHERE id = $1
      `,
      [createdPayment.id],
    );

    const paymentError = new Error(
      error.response?.data?.message || "Unable to initialize Paystack payment",
    );

    paymentError.statusCode = 502;

    throw paymentError;
  }

  // ----------------------------------------------------------
  // CHECK PAYSTACK RESPONSE
  // ----------------------------------------------------------

  if (
    !paystackResponse.data ||
    !paystackResponse.data.status ||
    !paystackResponse.data.data
  ) {
    await pool.query(
      `
      UPDATE payments

      SET
        status = 'failed',
        updated_at = NOW()

      WHERE id = $1
      `,
      [createdPayment.id],
    );

    const error = new Error("Paystack failed to initialize the transaction");

    error.statusCode = 502;

    throw error;
  }

  const paystackData = paystackResponse.data.data;

  // ----------------------------------------------------------
  // SAVE PAYSTACK REFERENCE
  // ----------------------------------------------------------

  const updatedPaymentResult = await pool.query(
    `
    UPDATE payments

    SET
      provider_transaction_id = $1,
      status = 'pending',
      updated_at = NOW()

    WHERE id = $2

    RETURNING
      id,
      booking_id,
      customer_id,
      provider_id,
      amount,
      currency,
      platform_fee,
      processing_fee,
      customer_total,
      provider_amount,
      payment_provider,
      provider_transaction_id,
      status,
      paid_at,
      released_at,
      refunded_at,
      created_at,
      updated_at
    `,
    [paystackData.reference, createdPayment.id],
  );

  if (updatedPaymentResult.rows.length === 0) {
    const error = new Error(
      "Unable to update payment after Paystack initialization",
    );

    error.statusCode = 500;

    throw error;
  }

  return {
    booking,

    payment: updatedPaymentResult.rows[0],

    paystack: {
      authorization_url: paystackData.authorization_url,

      access_code: paystackData.access_code,

      reference: paystackData.reference,
    },
  };
};

// ============================================================
// CREDIT PROVIDER PENDING WALLET
// ============================================================

const creditProviderPendingWallet = async (paymentId, client = pool) => {
  // ----------------------------------------------------------
  // GET PAYMENT
  // ----------------------------------------------------------

  const paymentResult = await client.query(
    `
    SELECT
      id,
      provider_id,
      provider_amount,
      currency,
      status

    FROM payments

    WHERE id = $1

    FOR UPDATE
    `,
    [paymentId],
  );

  if (paymentResult.rows.length === 0) {
    const error = new Error("Payment not found");

    error.statusCode = 404;

    throw error;
  }

  const payment = paymentResult.rows[0];

  // ----------------------------------------------------------
  // PAYMENT MUST BE PAID
  // ----------------------------------------------------------

  if (payment.status !== "paid") {
    const error = new Error(
      "Provider wallet can only be credited after payment is paid",
    );

    error.statusCode = 400;

    throw error;
  }

  const providerAmount = Number(payment.provider_amount);

  if (!providerAmount || providerAmount <= 0) {
    const error = new Error("Invalid provider payment amount");

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXISTING WALLET TRANSACTION
  // ----------------------------------------------------------

  const existingTransaction = await client.query(
    `
    SELECT
      id,
      provider_id,
      type,
      amount,
      payment_id,
      balance_before,
      balance_after,
      reference,
      created_at

    FROM wallet_transactions

    WHERE payment_id = $1
      AND type = 'credit'

    LIMIT 1
    `,
    [payment.id],
  );

  if (existingTransaction.rows.length > 0) {
    return {
      alreadyCredited: true,

      transaction: existingTransaction.rows[0],
    };
  }

  // ----------------------------------------------------------
  // CREATE WALLET IF NECESSARY
  // ----------------------------------------------------------

  await client.query(
    `
    INSERT INTO provider_wallets (
      provider_id,
      available_balance,
      pending_balance,
      total_earned,
      total_withdrawn,
      currency
    )

    VALUES (
      $1,
      0,
      0,
      0,
      0,
      $2
    )

    ON CONFLICT (provider_id)
    DO NOTHING
    `,
    [payment.provider_id, payment.currency],
  );

  // ----------------------------------------------------------
  // LOCK PROVIDER WALLET
  // ----------------------------------------------------------

  const walletResult = await client.query(
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
    [payment.provider_id],
  );

  if (walletResult.rows.length === 0) {
    const error = new Error("Unable to create provider wallet");

    error.statusCode = 500;

    throw error;
  }

  const wallet = walletResult.rows[0];

  // ----------------------------------------------------------
  // CHECK CURRENCY
  // ----------------------------------------------------------

  if (wallet.currency !== payment.currency) {
    const error = new Error(
      "Provider wallet currency does not match payment currency",
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // BALANCE CALCULATIONS
  // ----------------------------------------------------------

  const balanceBefore = Number(wallet.pending_balance);

  const balanceAfter = balanceBefore + providerAmount;

  // ----------------------------------------------------------
  // UPDATE WALLET
  // ----------------------------------------------------------

  const updatedWalletResult = await client.query(
    `
    UPDATE provider_wallets

    SET
      pending_balance =
        pending_balance + $1,

      total_earned =
        total_earned + $1,

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
    [providerAmount, wallet.id],
  );

  const updatedWallet = updatedWalletResult.rows[0];

  // ----------------------------------------------------------
  // CREATE WALLET TRANSACTION
  // ----------------------------------------------------------

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
      payment_id
    )

    VALUES (
      $1,
      'credit',
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
      payment_id,
      payout_id,
      created_at
    `,
    [
      payment.provider_id,
      providerAmount,
      payment.currency,
      `WALLET-CREDIT-${payment.id}`,
      "Payment received for completed NaijaFix booking",
      balanceBefore,
      balanceAfter,
      payment.id,
    ],
  );

  return {
    alreadyCredited: false,

    wallet: updatedWallet,

    transaction: transactionResult.rows[0],
  };
};

// ============================================================
// RELEASE PROVIDER PAYMENT
// ============================================================

const releasePayment = async (customerId, paymentId) => {
  if (!paymentId) {
    const error = new Error("Payment ID is required");

    error.statusCode = 400;

    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // LOCK PAYMENT
    // --------------------------------------------------------

    const paymentResult = await client.query(
      `
      SELECT
        p.id,
        p.booking_id,
        p.customer_id,
        p.provider_id,
        p.amount,
        p.currency,
        p.platform_fee,
        p.processing_fee,
        p.customer_total,
        p.provider_amount,
        p.payment_provider,
        p.provider_transaction_id,
        p.status,
        p.paid_at,
        p.released_at,
        p.refunded_at,
        p.created_at,
        p.updated_at,

        b.status AS booking_status

      FROM payments p

      INNER JOIN bookings b
        ON b.id = p.booking_id

      WHERE p.id = $1
        AND p.customer_id = $2

      FOR UPDATE
      `,
      [paymentId, customerId],
    );

    if (paymentResult.rows.length === 0) {
      const error = new Error(
        "Payment not found or you are not authorized to release it",
      );

      error.statusCode = 404;

      throw error;
    }

    const payment = paymentResult.rows[0];

    // --------------------------------------------------------
    // ALREADY RELEASED
    // --------------------------------------------------------

    if (payment.status === "released") {
      await client.query("COMMIT");

      return {
        alreadyReleased: true,

        payment,

        wallet: null,

        walletTransaction: null,
      };
    }

    // --------------------------------------------------------
    // PAYMENT MUST BE PAID
    // --------------------------------------------------------

    if (payment.status !== "paid") {
      const error = new Error(
        "Payment can only be released after it has been successfully paid",
      );

      error.statusCode = 400;

      throw error;
    }

    // --------------------------------------------------------
    // BOOKING MUST BE COMPLETED
    // --------------------------------------------------------

    if (payment.booking_status !== "completed") {
      const error = new Error(
        "Payment can only be released for a completed booking",
      );

      error.statusCode = 400;

      throw error;
    }

    // --------------------------------------------------------
    // PROVIDER AMOUNT
    // --------------------------------------------------------

    const providerAmount = Number(payment.provider_amount);

    if (!providerAmount || providerAmount <= 0) {
      const error = new Error("Invalid provider payment amount");

      error.statusCode = 400;

      throw error;
    }

    // --------------------------------------------------------
    // LOCK PROVIDER WALLET
    // --------------------------------------------------------

    const walletResult = await client.query(
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
      [payment.provider_id],
    );

    if (walletResult.rows.length === 0) {
      const error = new Error("Provider wallet not found");

      error.statusCode = 404;

      throw error;
    }

    const wallet = walletResult.rows[0];

    // --------------------------------------------------------
    // CHECK CURRENCY
    // --------------------------------------------------------

    if (wallet.currency !== payment.currency) {
      const error = new Error(
        "Provider wallet currency does not match payment currency",
      );

      error.statusCode = 400;

      throw error;
    }

    // --------------------------------------------------------
    // CHECK PENDING BALANCE
    // --------------------------------------------------------

    const pendingBalance = Number(wallet.pending_balance);

    if (pendingBalance < providerAmount) {
      const error = new Error("Insufficient pending balance for this payment");

      error.statusCode = 400;

      throw error;
    }

    // --------------------------------------------------------
    // BALANCE CALCULATIONS
    // --------------------------------------------------------

    const pendingBefore = pendingBalance;

    const pendingAfter = pendingBefore - providerAmount;

    const availableBefore = Number(wallet.available_balance);

    const availableAfter = availableBefore + providerAmount;

    // --------------------------------------------------------
    // MOVE MONEY
    //
    // pending → available
    //
    // total_earned DOES NOT CHANGE
    // --------------------------------------------------------

    const updatedWalletResult = await client.query(
      `
      UPDATE provider_wallets

      SET
        pending_balance = pending_balance - $1,

        available_balance = available_balance + $1,

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
      [providerAmount, wallet.id],
    );

    if (updatedWalletResult.rows.length === 0) {
      const error = new Error("Unable to update provider wallet");

      error.statusCode = 500;

      throw error;
    }

    const updatedWallet = updatedWalletResult.rows[0];

    // --------------------------------------------------------
    // MARK PAYMENT AS RELEASED
    // --------------------------------------------------------

    const updatedPaymentResult = await client.query(
      `
      UPDATE payments

      SET
        status = 'released',

        released_at = NOW(),

        updated_at = NOW()

      WHERE id = $1

      RETURNING
        id,
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        provider_transaction_id,
        status,
        paid_at,
        released_at,
        refunded_at,
        created_at,
        updated_at
      `,
      [payment.id],
    );

    if (updatedPaymentResult.rows.length === 0) {
      const error = new Error("Unable to release payment");

      error.statusCode = 500;

      throw error;
    }

    const updatedPayment = updatedPaymentResult.rows[0];

    // --------------------------------------------------------
    // CREATE WALLET TRANSACTION
    // --------------------------------------------------------

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
        payment_id
      )

      VALUES (
        $1,
        'credit',
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
        payment_id,
        payout_id,
        created_at
      `,
      [
        payment.provider_id,
        providerAmount,
        payment.currency,
        `WALLET-RELEASE-${payment.id}`,
        "Payment released to provider after customer confirmation",
        availableBefore,
        availableAfter,
        payment.id,
      ],
    );

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    // --------------------------------------------------------
    // NOTIFY PROVIDER
    // --------------------------------------------------------
    // IMPORTANT:
    // Notification happens AFTER COMMIT.
    // --------------------------------------------------------

    await sendNotification({
      userId: updatedPayment.provider_id,
      type: "payment_released",
      title: "Payment Released",
      message: `₦${Number(
        updatedPayment.provider_amount,
      ).toLocaleString()} has been released to your available wallet balance.`,
      actionUrl: `/wallet`,
    });

    return {
      alreadyReleased: false,

      payment: updatedPayment,

      wallet: updatedWallet,

      walletTransaction: transactionResult.rows[0],
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
// RECORD PAYMENT TRANSACTION
// ============================================================

const createPaymentTransaction = async (payment, reference, client) => {
  const result = await client.query(
    `
    INSERT INTO payment_transactions (
      payment_id,
      type,
      amount,
      currency,
      reference
    )

    VALUES (
      $1,
      'payment',
      $2,
      $3,
      $4
    )

    ON CONFLICT (reference)

    DO NOTHING

    RETURNING
      id,
      payment_id,
      type,
      amount,
      currency,
      reference
    `,
    [payment.id, payment.amount, payment.currency, `PAY-${reference}`],
  );

  return result.rows[0] || null;
};

// ============================================================
// PROCESS SUCCESSFUL PAYMENT
// ============================================================

const processSuccessfulPayment = async (paymentId, paystackData, client) => {
  // ----------------------------------------------------------
  // LOCK PAYMENT
  // ----------------------------------------------------------

  const paymentResult = await client.query(
    `
    SELECT
      id,
      booking_id,
      customer_id,
      provider_id,
      amount,
      currency,
      platform_fee,
      processing_fee,
      customer_total,
      provider_amount,
      payment_provider,
      provider_transaction_id,
      status,
      paid_at,
      released_at,
      refunded_at,
      created_at,
      updated_at

    FROM payments

    WHERE id = $1

    FOR UPDATE
    `,
    [paymentId],
  );

  if (paymentResult.rows.length === 0) {
    const error = new Error("Payment no longer exists");

    error.statusCode = 404;

    throw error;
  }

  const payment = paymentResult.rows[0];

  // ----------------------------------------------------------
  // ALREADY PROCESSED
  // ----------------------------------------------------------

  if (payment.status === "paid" || payment.status === "released") {
    return {
      payment,
      alreadyProcessed: true,
      paymentTransaction: null,
      wallet: null,
      walletTransaction: null,
      alreadyCredited: true,
    };
  }

  // ----------------------------------------------------------
  // MARK PAYMENT AS PAID
  // ----------------------------------------------------------

  const updatedPaymentResult = await client.query(
    `
    UPDATE payments

    SET
      status = 'paid',

      paid_at = COALESCE($1, NOW()),

      provider_transaction_id = $2,

      updated_at = NOW()

    WHERE id = $3

    RETURNING
      id,
      booking_id,
      customer_id,
      provider_id,
      amount,
      currency,
      platform_fee,
      processing_fee,
      customer_total,
      provider_amount,
      payment_provider,
      provider_transaction_id,
      status,
      paid_at,
      released_at,
      refunded_at,
      created_at,
      updated_at
    `,
    [
      paystackData.paid_at ? new Date(paystackData.paid_at) : null,
      paystackData.reference,
      payment.id,
    ],
  );

  const updatedPayment = updatedPaymentResult.rows[0];

  // ----------------------------------------------------------
  // RECORD PAYMENT TRANSACTION
  // ----------------------------------------------------------

  const paymentTransaction = await createPaymentTransaction(
    updatedPayment,
    paystackData.reference,
    client,
  );

  // ----------------------------------------------------------
  // CREDIT PROVIDER PENDING WALLET
  // ----------------------------------------------------------

  const walletResult = await creditProviderPendingWallet(
    updatedPayment.id,
    client,
  );

  return {
    payment: updatedPayment,

    alreadyProcessed: false,

    paymentTransaction,

    wallet: walletResult.wallet || null,

    walletTransaction: walletResult.transaction || null,

    alreadyCredited: walletResult.alreadyCredited,
  };
};

// ============================================================
// VERIFY PAYMENT
// ============================================================

const verifyPayment = async (customerId, reference) => {
  if (!reference) {
    const error = new Error("Payment reference is required");

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // FIND OUR PAYMENT
  // ----------------------------------------------------------

  const paymentResult = await pool.query(
    `
    SELECT
      p.id,
      p.booking_id,
      p.customer_id,
      p.provider_id,
      p.amount,
      p.currency,
      p.platform_fee,
      p.processing_fee,
      p.customer_total,
      p.provider_amount,
      p.payment_provider,
      p.provider_transaction_id,
      p.status,
      p.paid_at,
      p.released_at,
      p.refunded_at,
      p.created_at,
      p.updated_at,

      b.agreed_amount,
      b.currency AS booking_currency,
      b.status AS booking_status

    FROM payments p

    INNER JOIN bookings b
      ON b.id = p.booking_id

    WHERE p.provider_transaction_id = $1

      AND p.customer_id = $2

    LIMIT 1
    `,
    [reference, customerId],
  );

  if (paymentResult.rows.length === 0) {
    const error = new Error("Payment not found");

    error.statusCode = 404;

    throw error;
  }

  const payment = paymentResult.rows[0];

  // ----------------------------------------------------------
  // ALREADY COMPLETED
  // ----------------------------------------------------------

  if (isCompletedPayment(payment.status)) {
    return {
      payment,

      alreadyVerified: true,
    };
  }

  // ----------------------------------------------------------
  // ONLY PAYSTACK
  // ----------------------------------------------------------

  if (payment.payment_provider !== "paystack") {
    const error = new Error("Unsupported payment provider");

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // VERIFY WITH PAYSTACK
  // ----------------------------------------------------------

  let paystackResponse;

  try {
    paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        reference,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );
  } catch (error) {
    console.error(
      "Paystack verification error:",
      error.response?.data || error.message,
    );

    const verificationError = new Error(
      error.response?.data?.message || "Unable to verify payment with Paystack",
    );

    verificationError.statusCode = 502;

    throw verificationError;
  }

  // ----------------------------------------------------------
  // CHECK PAYSTACK RESPONSE
  // ----------------------------------------------------------

  if (
    !paystackResponse.data ||
    !paystackResponse.data.status ||
    !paystackResponse.data.data
  ) {
    const error = new Error("Paystack payment verification failed");

    error.statusCode = 502;

    throw error;
  }

  const paystackData = paystackResponse.data.data;

  // ----------------------------------------------------------
  // CHECK TRANSACTION STATUS
  // ----------------------------------------------------------

  if (paystackData.status !== "success") {
    const error = new Error(
      `Payment has not been completed. Paystack status: ${paystackData.status}`,
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // CHECK REFERENCE
  // ----------------------------------------------------------

  if (paystackData.reference !== reference) {
    const error = new Error("Payment reference mismatch");

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // CHECK CURRENCY
  // ----------------------------------------------------------

  if (paystackData.currency !== payment.currency) {
    const error = new Error(
      "Payment currency does not match the booking currency",
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXACT CUSTOMER PAYMENT
  // ----------------------------------------------------------

  const expectedAmountInSubunit = Math.round(
    Number(payment.customer_total) * 100,
  );

  const paidAmountInSubunit = Number(paystackData.amount);

  if (paidAmountInSubunit !== expectedAmountInSubunit) {
    console.error("Payment amount mismatch:", {
      expected: expectedAmountInSubunit,
      received: paidAmountInSubunit,
      paymentId: payment.id,
      reference,
    });

    const error = new Error(
      "Payment amount does not match the required amount",
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // START DATABASE TRANSACTION
  // ----------------------------------------------------------

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // LOCK PAYMENT
    // --------------------------------------------------------

    const lockedPaymentResult = await client.query(
      `
      SELECT
        id,
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        provider_transaction_id,
        status,
        paid_at,
        released_at,
        refunded_at,
        created_at,
        updated_at

      FROM payments

      WHERE id = $1

      FOR UPDATE
      `,
      [payment.id],
    );

    if (lockedPaymentResult.rows.length === 0) {
      const error = new Error("Payment no longer exists");

      error.statusCode = 404;

      throw error;
    }

    const lockedPayment = lockedPaymentResult.rows[0];

    // --------------------------------------------------------
    // HANDLE RACE CONDITION
    // --------------------------------------------------------

    if (isCompletedPayment(lockedPayment.status)) {
      await client.query("COMMIT");

      return {
        payment: lockedPayment,

        alreadyVerified: true,
      };
    }

    // --------------------------------------------------------
    // MARK PAYMENT AS PAID
    // --------------------------------------------------------

    const updatedPaymentResult = await client.query(
      `
      UPDATE payments

      SET
        status = 'paid',

        paid_at =
          COALESCE($1, NOW()),

        provider_transaction_id = $2,

        updated_at = NOW()

      WHERE id = $3

      RETURNING
        id,
        booking_id,
        customer_id,
        provider_id,
        amount,
        currency,
        platform_fee,
        processing_fee,
        customer_total,
        provider_amount,
        payment_provider,
        provider_transaction_id,
        status,
        paid_at,
        released_at,
        refunded_at,
        created_at,
        updated_at
      `,
      [
        paystackData.paid_at ? new Date(paystackData.paid_at) : null,

        paystackData.reference,

        payment.id,
      ],
    );

    const updatedPayment = updatedPaymentResult.rows[0];

    // --------------------------------------------------------
    // CREATE PAYMENT TRANSACTION
    // --------------------------------------------------------

    const paymentTransaction = await createPaymentTransaction(
      updatedPayment,
      paystackData.reference,
      client,
    );

    // --------------------------------------------------------
    // CREDIT PROVIDER PENDING WALLET
    // --------------------------------------------------------

    const walletResult = await creditProviderPendingWallet(
      updatedPayment.id,
      client,
    );

    // --------------------------------------------------------
    // COMMIT EVERYTHING
    // --------------------------------------------------------

    await client.query("COMMIT");

    // ========================================================
    // NOTIFICATIONS
    // ========================================================
    //
    // These happen AFTER COMMIT.
    //
    // If notification creation fails, the payment remains
    // successful.
    // ========================================================

    // --------------------------------------------------------
    // CUSTOMER PAYMENT SUCCESS
    // --------------------------------------------------------

    await sendNotification({
      userId: updatedPayment.customer_id,
      type: "payment_successful",
      title: "Payment Successful",
      message: `Your payment of ₦${Number(
        updatedPayment.customer_total,
      ).toLocaleString()} was successful.`,
      actionUrl: `/payments/${updatedPayment.id}`,
    });

    // --------------------------------------------------------
    // PROVIDER PAYMENT RECEIVED
    // --------------------------------------------------------

    await sendNotification({
      userId: updatedPayment.provider_id,
      type: "payment_received",
      title: "Payment Received",
      message: `₦${Number(
        updatedPayment.provider_amount,
      ).toLocaleString()} has been received and added to your pending balance.`,
      actionUrl: `/wallet`,
    });

    // --------------------------------------------------------
    // RETURN
    // --------------------------------------------------------

    return {
      payment: updatedPayment,

      paymentTransaction,

      wallet: walletResult.wallet || null,

      walletTransaction: walletResult.transaction || null,

      alreadyCredited: walletResult.alreadyCredited,

      alreadyVerified: false,
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
  calculatePlatformFee,
  getBookingPaymentDetails,
  initializePaystackTransaction,
  createPayment,
  creditProviderPendingWallet,
  releasePayment,
  createPaymentTransaction,
  processSuccessfulPayment,
  verifyPayment,
};

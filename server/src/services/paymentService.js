const axios = require("axios");
const pool = require("../config/database");
const notificationService = require("./notificationService");
const { sendOperationalEmail } = require("./emailService");

// ============================================================
// NOTIFICATIONS
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

const sendPaymentEmail = async (options) => {
  try {
    await sendOperationalEmail(options);
  } catch (error) {
    console.error("Payment email error:", {
      message: error.message,
      code: error.code,
    });
  }
};

// ============================================================
// PLATFORM FEE
// ============================================================

const calculatePlatformFee = (amount) => {
  if (amount <= 50000) return 500;
  if (amount <= 100000) return 1000;
  if (amount <= 200000) return 1500;
  if (amount <= 500000) return 2500;

  return 5000;
};

// ============================================================
// PAYMENT HELPERS
// ============================================================

const isCompletedPayment = (status) =>
  ["paid", "released"].includes(status);

const paymentColumns = `
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
  p.booking_amount,
  p.booking_currency,
  p.provider_currency,
  p.exchange_rate,
  p.checkout_url,
  p.checkout_access_code,
  p.created_at,
  p.updated_at
`;

const paymentReturningColumns = `
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
  booking_amount,
  booking_currency,
  provider_currency,
  exchange_rate,
  checkout_url,
  checkout_access_code,
  created_at,
  updated_at
`;

// ============================================================
// GET BOOKING PAYMENT DETAILS
// ============================================================

const getBookingPaymentDetails = async (
  customerId,
  bookingId,
) => {
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

    LIMIT 1
    `,
    [bookingId, customerId],
  );

  if (!result.rows.length) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = result.rows[0];

  if (booking.status !== "accepted") {
    const error = new Error(
      "Payment can only be initialized after the customer selects a provider",
    );

    error.statusCode = 400;
    throw error;
  }

  const paymentResult = await pool.query(
    `
    SELECT
      ${paymentColumns}

    FROM payments p

    WHERE p.booking_id = $1

    LIMIT 1
    `,
    [bookingId],
  );

  if (paymentResult.rows.length) {
    const payment = paymentResult.rows[0];

    if (isCompletedPayment(payment.status)) {
      const error = new Error(
        "This booking has already been paid for",
      );

      error.statusCode = 400;
      throw error;
    }

    return {
      booking,
      payment,
    };
  }

  const amount = Number(booking.agreed_amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Invalid booking amount");
    error.statusCode = 400;
    throw error;
  }

  const platformFee = calculatePlatformFee(amount);
  const processingFee = 0;
  const customerTotal =
    amount + platformFee + processingFee;

  return {
    booking,

    payment: {
      bookingAmount: amount,
      bookingCurrency: booking.currency,
      platformFee,
      processingFee,
      customerTotal,
      providerAmount: amount,
    },
  };
};

const getMyPayments = async (customerId) => {
  const result = await pool.query(
    `
    SELECT
      p.id AS payment_id,
      p.amount,
      p.currency,
      p.platform_fee,
      p.processing_fee,
      p.customer_total,
      p.provider_amount,
      p.payment_provider,
      p.provider_transaction_id,
      p.status AS payment_status,
      p.paid_at,
      p.released_at,
      p.refunded_at,
      p.checkout_url,
      p.created_at AS payment_created_at,
      p.updated_at AS payment_updated_at,

      b.id AS booking_id,
      b.agreed_amount,
      b.currency AS booking_currency,
      b.status AS booking_status,
      b.created_at AS booking_created_at,

      o.title AS opportunity_title,
      s.title AS service_title,

      provider.first_name AS provider_first_name,
      provider.last_name AS provider_last_name,
      provider.username AS provider_username

    FROM bookings b

    INNER JOIN opportunities o
      ON o.id = b.opportunity_id

    INNER JOIN services s
      ON s.id = b.service_id

    INNER JOIN profiles provider
      ON provider.user_id = b.provider_id

    LEFT JOIN payments p
      ON p.booking_id = b.id

    WHERE b.customer_id = $1
      AND (p.id IS NOT NULL OR b.status = 'accepted')

    ORDER BY
      COALESCE(p.updated_at, b.updated_at) DESC,
      b.created_at DESC
    `,
    [customerId],
  );

  return result.rows;
};

// ============================================================
// INITIALIZE PAYSTACK TRANSACTION
// ============================================================

const initializePaystackTransaction = async ({
  payment,
  booking,
  client = pool,
}) => {
  const amountInSubunit = Math.round(
    Number(
      payment.customer_total ??
      payment.customerTotal,
    ) * 100,
  );

  if (
    !Number.isFinite(amountInSubunit) ||
    amountInSubunit <= 0
  ) {
    const error = new Error(
      "Invalid payment amount",
    );

    error.statusCode = 400;
    throw error;
  }

  const reference =
    payment.provider_transaction_id ||
    `NF-${payment.id}`;

  let response;

  try {
    response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: booking.customer_email,
        amount: amountInSubunit,
        currency: booking.currency,
        reference,
        callback_url: `${String(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim()}/client/payments`,

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

    const e = new Error(
      error.response?.data?.message ||
      "Unable to initialize Paystack payment",
    );

    e.statusCode = 502;

    throw e;
  }

  if (
    !response.data?.status ||
    !response.data?.data
  ) {
    const e = new Error(
      "Paystack failed to initialize the transaction",
    );

    e.statusCode = 502;
    throw e;
  }

  const data = response.data.data;

  const updated = await client.query(
    `
    UPDATE payments

    SET
      provider_transaction_id = $1,
      checkout_url = $2,
      checkout_access_code = $3,
      status = 'pending',
      updated_at = NOW()

    WHERE id = $4

    RETURNING ${paymentReturningColumns}
    `,
    [
      data.reference,
      data.authorization_url,
      data.access_code,
      payment.id,
    ],
  );

  if (!updated.rows.length) {
    const e = new Error(
      "Unable to save Paystack payment reference",
    );

    e.statusCode = 500;
    throw e;
  }

  return {
    payment: updated.rows[0],

    paystack: {
      authorization_url:
        data.authorization_url,

      access_code:
        data.access_code,

      reference:
        data.reference,
    },
  };
};

// ============================================================
// CREATE PAYMENT
// ============================================================

const createPayment = async (
  customerId,
  bookingId,
  paymentProvider = "paystack",
) => {
  if (paymentProvider !== "paystack") {
    const error = new Error(
      "Only Paystack payments are currently supported",
    );

    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // LOCK BOOKING
    // --------------------------------------------------------

    const bookingResult = await client.query(
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

      FOR UPDATE OF b
      `,
      [
        bookingId,
        customerId,
      ],
    );

    if (!bookingResult.rows.length) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "accepted") {
      const error = new Error(
        "Payment can only be initialized after the customer selects a provider",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // LOCK PAYMENT
    // --------------------------------------------------------

    const paymentResult = await client.query(
      `
      SELECT
        ${paymentColumns}

      FROM payments p

      WHERE p.booking_id = $1

      FOR UPDATE
      `,
      [bookingId],
    );

    let payment =
      paymentResult.rows[0] || null;

    // --------------------------------------------------------
    // EXISTING PAYMENT
    // --------------------------------------------------------

    if (payment) {
      if (isCompletedPayment(payment.status)) {
        const error = new Error(
          "This booking has already been paid for",
        );

        error.statusCode = 400;
        throw error;
      }

      if (
        payment.checkout_url &&
        payment.provider_transaction_id
      ) {
        await client.query("COMMIT");

        return {
          booking,
          payment,

          paystack: {
            authorization_url:
              payment.checkout_url,

            access_code:
              payment.checkout_access_code,

            reference:
              payment.provider_transaction_id,
          },
        };
      }

      const amount = Number(
        booking.agreed_amount,
      );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        const error = new Error(
          "Invalid booking amount",
        );

        error.statusCode = 400;
        throw error;
      }

      const initialized =
        await initializePaystackTransaction({
          payment,
          booking,
          client,
        });

      await client.query("COMMIT");

      return initialized;
    }

    // --------------------------------------------------------
    // CREATE NEW PAYMENT
    // --------------------------------------------------------

    const amount = Number(
      booking.agreed_amount,
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      const error = new Error(
        "Invalid booking amount",
      );

      error.statusCode = 400;
      throw error;
    }

    const platformFee =
      calculatePlatformFee(amount);

    const processingFee = 0;

    const customerTotal =
      amount +
      platformFee +
      processingFee;

    const insertResult =
      await client.query(
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
          booking_amount,
          booking_currency,
          provider_currency,
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
          $4,
          $5,
          $5,
          'pending'
        )

        RETURNING ${paymentReturningColumns}
        `,
        [
          booking.id,
          booking.customer_id,
          booking.provider_id,
          amount,
          booking.currency,
          platformFee,
          processingFee,
          customerTotal,
          amount,
          paymentProvider,
        ],
      );

    payment =
      insertResult.rows[0];

    const initialized =
      await initializePaystackTransaction({
        payment,
        booking,
        client,
      });

    await client.query("COMMIT");

    return initialized;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// CREATE PAYMENT TRANSACTION
// ============================================================

const createPaymentTransaction = async (
  payment,
  reference,
  client,
) => {
  if (!payment || !payment.id) {
    const error = new Error(
      "Payment is required to create payment transaction",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!client) {
    const error = new Error(
      "Database client is required to create payment transaction",
    );

    error.statusCode = 500;
    throw error;
  }

  if (!reference) {
    const error = new Error(
      "Payment transaction reference is required",
    );

    error.statusCode = 400;
    throw error;
  }

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

    ON CONFLICT DO NOTHING

    RETURNING
      id,
      payment_id,
      type,
      amount,
      currency,
      reference,
      created_at
    `,
    [
      payment.id,
      payment.amount,
      payment.currency,
      `PAY-${reference}`,
    ],
  );

  if (result.rows.length) {
    return result.rows[0];
  }

  const existing = await client.query(
    `
    SELECT
      id,
      payment_id,
      type,
      amount,
      currency,
      reference,
      created_at

    FROM payment_transactions

    WHERE payment_id = $1
      AND type = 'payment'

    ORDER BY created_at ASC

    LIMIT 1
    `,
    [payment.id],
  );

  return existing.rows[0] || null;
};

// ============================================================
// CREATE PAYMENT EVENT TRANSACTION
// ============================================================

const createPaymentEventTransaction = async (
  payment,
  type,
  amount,
  reference,
  client,
) => {
  if (!payment || !payment.id) {
    const error = new Error(
      "Payment is required to create payment event transaction",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!client) {
    const error = new Error(
      "Database client is required to create payment event transaction",
    );

    error.statusCode = 500;
    throw error;
  }

  const allowedTypes = [
    "release",
    "refund",
  ];

  if (!allowedTypes.includes(type)) {
    const error = new Error(
      `Unsupported payment event transaction type: ${type}`,
    );

    error.statusCode = 400;
    throw error;
  }

  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    const error = new Error(
      "Invalid payment event transaction amount",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!reference) {
    const error = new Error(
      "Payment event transaction reference is required",
    );

    error.statusCode = 400;
    throw error;
  }

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
      $2,
      $3,
      $4,
      $5
    )

    ON CONFLICT DO NOTHING

    RETURNING
      id,
      payment_id,
      type,
      amount,
      currency,
      reference,
      created_at
    `,
    [
      payment.id,
      type,
      numericAmount,
      payment.currency,
      reference,
    ],
  );

  if (result.rows.length) {
    return result.rows[0];
  }

  const existing = await client.query(
    `
    SELECT
      id,
      payment_id,
      type,
      amount,
      currency,
      reference,
      created_at

    FROM payment_transactions

    WHERE payment_id = $1
      AND type = $2

    ORDER BY created_at ASC

    LIMIT 1
    `,
    [
      payment.id,
      type,
    ],
  );

  return existing.rows[0] || null;
};

// ============================================================
// CREDIT PROVIDER PENDING WALLET
// ============================================================

const creditProviderPendingWallet = async (
  paymentId,
  client = pool,
) => {
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

  if (!paymentResult.rows.length) {
    const error = new Error(
      "Payment not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const payment =
    paymentResult.rows[0];

  if (payment.status !== "paid") {
    const error = new Error(
      "Provider wallet can only be credited after payment is paid",
    );

    error.statusCode = 400;
    throw error;
  }

  const providerAmount =
    Number(payment.provider_amount);

  if (
    !Number.isFinite(providerAmount) ||
    providerAmount <= 0
  ) {
    const error = new Error(
      "Invalid provider payment amount",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // IDEMPOTENCY CHECK
  // ----------------------------------------------------------

  const existing =
    await client.query(
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
        AND reference = $2

      LIMIT 1
      `,
      [
        payment.id,
        `WALLET-CREDIT-${payment.id}`,
      ],
    );

  if (existing.rows.length) {
    return {
      alreadyCredited: true,
      transaction:
        existing.rows[0],
    };
  }

  // ----------------------------------------------------------
  // CREATE WALLET
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
    [
      payment.provider_id,
      payment.currency,
    ],
  );

  // ----------------------------------------------------------
  // LOCK WALLET
  // ----------------------------------------------------------

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
        currency,
        created_at,
        updated_at

      FROM provider_wallets

      WHERE provider_id = $1

      FOR UPDATE
      `,
      [payment.provider_id],
    );

  if (!walletResult.rows.length) {
    const error = new Error(
      "Unable to create provider wallet",
    );

    error.statusCode = 500;
    throw error;
  }

  const wallet =
    walletResult.rows[0];

  if (
    wallet.currency !==
    payment.currency
  ) {
    const error = new Error(
      "Provider wallet currency does not match payment currency",
    );

    error.statusCode = 400;
    throw error;
  }

  const before =
    Number(wallet.pending_balance);

  const after =
    before + providerAmount;

  // ----------------------------------------------------------
  // UPDATE WALLET
  // ----------------------------------------------------------

  const updatedWallet =
    await client.query(
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
      [
        providerAmount,
        wallet.id,
      ],
    );

  // ----------------------------------------------------------
  // WALLET LEDGER
  // ----------------------------------------------------------

  const transaction =
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
        "Payment received and held pending job completion",
        before,
        after,
        payment.id,
      ],
    );

  return {
    alreadyCredited: false,

    wallet:
      updatedWallet.rows[0],

    transaction:
      transaction.rows[0],
  };
};

// ============================================================
// RELEASE PAYMENT IN TRANSACTION
// ============================================================

const releasePaymentInTransaction = async (
  customerId,
  paymentId,
  client,
) => {
  const result = await client.query(
    `
    SELECT
      ${paymentColumns},

      b.status AS booking_status,
      b.customer_confirmed_at

    FROM payments p

    INNER JOIN bookings b
      ON b.id = p.booking_id

    WHERE p.id = $1
      AND p.customer_id = $2

    FOR UPDATE OF p, b
    `,
    [
      paymentId,
      customerId,
    ],
  );

  if (!result.rows.length) {
    const error = new Error(
      "Payment not found or you are not authorized to release it",
    );

    error.statusCode = 404;
    throw error;
  }

  const payment =
    result.rows[0];

  // ----------------------------------------------------------
  // ALREADY RELEASED
  // ----------------------------------------------------------

  if (payment.status === "released") {
    const releaseTransaction =
      await createPaymentEventTransaction(
        payment,
        "release",
        Number(payment.provider_amount),
        `RELEASE-${payment.provider_transaction_id || payment.id}`,
        client,
      );

    return {
      alreadyReleased: true,

      payment,

      wallet: null,

      walletTransaction: null,

      paymentTransaction:
        releaseTransaction,
    };
  }

  // ----------------------------------------------------------
  // PAYMENT MUST BE PAID
  // ----------------------------------------------------------

  if (payment.status !== "paid") {
    const error = new Error(
      "Payment can only be released after successful payment",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // BOOKING MUST BE COMPLETED + CONFIRMED
  // ----------------------------------------------------------

  if (
    payment.booking_status !== "completed" ||
    !payment.customer_confirmed_at
  ) {
    const error = new Error(
      "Payment can only be released after the customer confirms a completed booking",
    );

    error.statusCode = 400;
    throw error;
  }

  const amount =
    Number(payment.provider_amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    const error = new Error(
      "Invalid provider payment amount",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // LOCK PROVIDER WALLET
  // ----------------------------------------------------------

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
        currency,
        created_at,
        updated_at

      FROM provider_wallets

      WHERE provider_id = $1

      FOR UPDATE
      `,
      [payment.provider_id],
    );

  if (!walletResult.rows.length) {
    const error = new Error(
      "Provider wallet not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const wallet =
    walletResult.rows[0];

  if (
    wallet.currency !==
    payment.currency
  ) {
    const error = new Error(
      "Provider wallet currency does not match payment currency",
    );

    error.statusCode = 400;
    throw error;
  }

  const pendingBefore =
    Number(wallet.pending_balance);

  if (pendingBefore < amount) {
    const error = new Error(
      "Insufficient pending balance for this payment",
    );

    error.statusCode = 400;
    throw error;
  }

  const availableBefore =
    Number(wallet.available_balance);

  // ----------------------------------------------------------
  // MOVE PENDING -> AVAILABLE
  // ----------------------------------------------------------

  const updatedWallet =
    await client.query(
      `
      UPDATE provider_wallets

      SET
        pending_balance =
          pending_balance - $1,

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
        amount,
        wallet.id,
      ],
    );

  // ----------------------------------------------------------
  // MARK PAYMENT RELEASED
  // ----------------------------------------------------------

  const updatedPayment =
    await client.query(
      `
      UPDATE payments

      SET
        status = 'released',
        released_at = NOW(),
        updated_at = NOW()

      WHERE id = $1

      RETURNING ${paymentReturningColumns}
      `,
      [payment.id],
    );

  const releasedPayment =
    updatedPayment.rows[0];

  // ----------------------------------------------------------
  // WALLET LEDGER
  // ----------------------------------------------------------

  const walletTransaction =
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
        amount,
        payment.currency,
        `WALLET-RELEASE-${payment.id}`,
        "Payment released after customer confirmation",
        availableBefore,
        availableBefore + amount,
        payment.id,
      ],
    );

  // ----------------------------------------------------------
  // PAYMENT LEDGER
  // ----------------------------------------------------------

  const paymentTransaction =
    await createPaymentEventTransaction(
      releasedPayment,
      "release",
      amount,
      `RELEASE-${releasedPayment.provider_transaction_id || releasedPayment.id}`,
      client,
    );

  return {
    alreadyReleased: false,

    payment:
      releasedPayment,

    wallet:
      updatedWallet.rows[0],

    walletTransaction:
      walletTransaction.rows[0],

    paymentTransaction,
  };
};

// ============================================================
// RELEASE PAYMENT
// ============================================================

const releasePayment = async (
  customerId,
  paymentId,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await releasePaymentInTransaction(
        customerId,
        paymentId,
        client,
      );

    await client.query("COMMIT");

    if (!result.alreadyReleased) {
      await sendNotification({
        userId:
          result.payment.provider_id,

        type:
          "payment_released",

        title:
          "Payment Released",

        message:
          `₦${Number(
            result.payment.provider_amount,
          ).toLocaleString()} has been released to your available wallet balance.`,

        actionUrl:
          "/wallet",
      });

    }

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// PROCESS SUCCESSFUL PAYMENT
// ============================================================

const processSuccessfulPayment = async (
  paymentId,
  paystackData,
  client,
) => {
  const result = await client.query(
    `
    SELECT
      ${paymentColumns}

    FROM payments p

    WHERE p.id = $1

    FOR UPDATE
    `,
    [paymentId],
  );

  if (!result.rows.length) {
    const error = new Error(
      "Payment no longer exists",
    );

    error.statusCode = 404;
    throw error;
  }

  const payment =
    result.rows[0];

  // ----------------------------------------------------------
  // ALREADY PROCESSED
  // ----------------------------------------------------------

  if (
    payment.status === "paid" ||
    payment.status === "released"
  ) {
    const paymentTransaction =
      await createPaymentTransaction(
        payment,
        payment.provider_transaction_id ||
        paystackData?.reference,
        client,
      );

    return {
      payment,

      alreadyProcessed: true,

      paymentTransaction,

      wallet: null,

      walletTransaction: null,

      alreadyCredited: true,
    };
  }

  // ----------------------------------------------------------
  // VALIDATE PAYSTACK
  // ----------------------------------------------------------

  const expected =
    Math.round(
      Number(payment.customer_total) * 100,
    );

  if (
    Number(paystackData.amount) !==
    expected ||
    String(paystackData.currency).toUpperCase() !==
    String(payment.currency).toUpperCase() ||
    paystackData.status !==
    "success"
  ) {
    const error = new Error(
      "Paystack payment does not match the expected successful transaction",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // UPDATE PAYMENT
  // ----------------------------------------------------------

  const updatedResult =
    await client.query(
      `
      UPDATE payments

      SET
        status = 'paid',

        paid_at =
          COALESCE($1, NOW()),

        provider_transaction_id =
          $2,

        updated_at = NOW()

      WHERE id = $3

      RETURNING ${paymentReturningColumns}
      `,
      [
        paystackData.paid_at
          ? new Date(paystackData.paid_at)
          : null,

        paystackData.reference,

        payment.id,
      ],
    );

  const updatedPayment =
    updatedResult.rows[0];

  // ----------------------------------------------------------
  // PAYMENT LEDGER
  // ----------------------------------------------------------

  const paymentTransaction =
    await createPaymentTransaction(
      updatedPayment,
      paystackData.reference,
      client,
    );

  // ----------------------------------------------------------
  // CREDIT PROVIDER PENDING WALLET
  // ----------------------------------------------------------

  const walletResult =
    await creditProviderPendingWallet(
      updatedPayment.id,
      client,
    );

  return {
    payment:
      updatedPayment,

    alreadyProcessed:
      false,

    paymentTransaction,

    wallet:
      walletResult.wallet ||
      null,

    walletTransaction:
      walletResult.transaction ||
      null,

    alreadyCredited:
      walletResult.alreadyCredited,
  };
};

// ============================================================
// VERIFY PAYMENT
// ============================================================

const verifyPayment = async (
  customerId,
  reference,
) => {
  if (!reference) {
    const error = new Error(
      "Payment reference is required",
    );

    error.statusCode = 400;
    throw error;
  }

  const local =
    await pool.query(
      `
      SELECT
        ${paymentColumns},

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
      [
        reference,
        customerId,
      ],
    );

  if (!local.rows.length) {
    const error = new Error(
      "Payment not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const payment =
    local.rows[0];

  if (isCompletedPayment(payment.status)) {
    return {
      payment,

      alreadyVerified: true,
    };
  }

  if (
    payment.payment_provider !==
    "paystack"
  ) {
    const error = new Error(
      "Unsupported payment provider",
    );

    error.statusCode = 400;
    throw error;
  }

  let response;

  try {
    response = await axios.get(
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
    const e = new Error(
      error.response?.data?.message ||
      "Unable to verify payment with Paystack",
    );

    e.statusCode = 502;

    throw e;
  }

  const data =
    response.data?.data;

  if (
    !response.data?.status ||
    !data
  ) {
    const error = new Error(
      "Paystack payment verification failed",
    );

    error.statusCode = 502;
    throw error;
  }

  if (data.status !== "success") {
    const error = new Error(
      `Payment has not been completed. Paystack status: ${data.status}`,
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    data.reference !== reference
  ) {
    const error = new Error(
      "Payment reference mismatch",
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    String(data.currency).toUpperCase() !==
    String(payment.currency).toUpperCase()
  ) {
    const error = new Error(
      "Payment currency does not match the booking currency",
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    Number(data.amount) !==
    Math.round(
      Number(payment.customer_total) * 100,
    )
  ) {
    const error = new Error(
      "Payment amount does not match the required amount",
    );

    error.statusCode = 400;
    throw error;
  }

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await processSuccessfulPayment(
        payment.id,
        data,
        client,
      );

    await client.query("COMMIT");

    if (!result.alreadyProcessed) {
      await sendNotification({
        userId:
          result.payment.customer_id,

        type:
          "payment_successful",

        title:
          "Payment Successful",

        message:
          `Your payment of ₦${Number(
            result.payment.customer_total,
          ).toLocaleString()} was successful.`,

        actionUrl:
          `/payments/${result.payment.id}`,
      });

      await sendNotification({
        userId:
          result.payment.provider_id,

        type:
          "payment_received",

        title:
          "Payment Received",

        message:
          `₦${Number(
            result.payment.provider_amount,
          ).toLocaleString()} has been received and is being held until the job is completed.`,

        actionUrl:
          "/wallet",
      });

      const recipients = await pool.query(
        `SELECT id, email, first_name FROM users WHERE id = ANY($1::uuid[])`,
        [[result.payment.customer_id, result.payment.provider_id]],
      );
      const recipientById = Object.fromEntries(
        recipients.rows.map((recipient) => [recipient.id, recipient]),
      );
      const customer = recipientById[result.payment.customer_id];
      const provider = recipientById[result.payment.provider_id];

      await sendPaymentEmail({
        email: customer?.email,
        subject: "Your Proservora payment was successful",
        eyebrow: "PAYMENT UPDATE",
        title: "Payment received",
        greeting: `Hello ${customer?.first_name || "there"},`,
        intro: "Your payment has been verified and your provider can now begin the booking.",
        details: [
          { label: "Amount paid", value: `${result.payment.currency} ${Number(result.payment.customer_total).toLocaleString()}` },
          { label: "Status", value: "Payment verified" },
        ],
        plainText: `Hello ${customer?.first_name || "there"},\n\nYour Proservora payment of ${result.payment.currency} ${Number(result.payment.customer_total).toLocaleString()} was verified. Your provider can now begin the booking.`,
      });

      await sendPaymentEmail({
        email: provider?.email,
        subject: "Payment received for your Proservora booking",
        eyebrow: "PAYMENT UPDATE",
        title: "Payment received",
        greeting: `Hello ${provider?.first_name || "there"},`,
        intro: "The customer’s payment has been verified and is being held securely until the job is completed.",
        details: [
          { label: "Provider amount", value: `${result.payment.currency} ${Number(result.payment.provider_amount).toLocaleString()}` },
          { label: "Status", value: "Ready to start" },
        ],
        plainText: `Hello ${provider?.first_name || "there"},\n\nPayment of ${result.payment.currency} ${Number(result.payment.provider_amount).toLocaleString()} has been verified for your Proservora booking and is being held until completion.`,
      });
    }

    return {
      ...result,

      alreadyVerified:
        false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// RESERVE REFUND INSIDE EXISTING TRANSACTION
// ============================================================
//
// IMPORTANT:
//
// This helper does NOT BEGIN or COMMIT a transaction.
//
// It is intended for adminDisputeService, which already has
// an active transaction and needs refund reservation + dispute
// state changes to happen atomically.
//
// ============================================================

const reserveRefundInTransaction = async ({
  paymentId,
  disputeId,
  adminId,
  client,
}) => {
  if (!client) {
    const error = new Error(
      "Database client is required to reserve refund",
    );

    error.statusCode = 500;
    throw error;
  }

  if (!paymentId) {
    const error = new Error(
      "Payment ID is required",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!disputeId) {
    const error = new Error(
      "Dispute ID is required",
    );

    error.statusCode = 400;
    throw error;
  }

  if (!adminId) {
    const error = new Error(
      "Admin ID is required",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // LOCK PAYMENT
  // ----------------------------------------------------------

  const paymentResult =
    await client.query(
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
        status

      FROM payments

      WHERE id = $1

      FOR UPDATE
      `,
      [paymentId],
    );

  if (!paymentResult.rows.length) {
    const error = new Error(
      "Payment not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const payment =
    paymentResult.rows[0];

  // ----------------------------------------------------------
  // LOCK DISPUTE + VALIDATE RELATIONSHIP
  // ----------------------------------------------------------

  const disputeResult =
    await client.query(
      `
      SELECT
        d.id,
        d.booking_id,
        d.opened_by,
        d.status,
        d.reason,
        d.description,

        b.customer_id,
        b.provider_id,
        b.status AS booking_status

      FROM disputes d

      INNER JOIN bookings b
        ON b.id = d.booking_id

      WHERE d.id = $1

      FOR UPDATE OF d, b
      `,
      [disputeId],
    );

  if (!disputeResult.rows.length) {
    const error = new Error(
      "Dispute not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const dispute =
    disputeResult.rows[0];

  // ----------------------------------------------------------
  // PAYMENT MUST BELONG TO DISPUTED BOOKING
  // ----------------------------------------------------------

  if (
    dispute.booking_id !==
    payment.booking_id
  ) {
    const error = new Error(
      "Dispute does not belong to the payment booking",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CUSTOMER MUST MATCH
  // ----------------------------------------------------------

  if (
    dispute.customer_id !==
    payment.customer_id
  ) {
    const error = new Error(
      "Dispute customer does not match payment customer",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PROVIDER MUST MATCH
  // ----------------------------------------------------------

  if (
    dispute.provider_id !==
    payment.provider_id
  ) {
    const error = new Error(
      "Dispute provider does not match payment provider",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // DISPUTE MUST STILL BE ACTIVE
  // ----------------------------------------------------------

  if (
    !["open", "under_review"].includes(
      dispute.status,
    )
  ) {
    const error = new Error(
      "Only open or under-review disputes can be refunded",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PAYMENT MUST BE PAID OR RELEASED
  // ----------------------------------------------------------

  if (
    payment.status !== "paid" &&
    payment.status !== "released"
  ) {
    const error = new Error(
      "Only paid or released payments can be refunded",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PAYSTACK ONLY
  // ----------------------------------------------------------

  if (
    payment.payment_provider !==
    "paystack"
  ) {
    const error = new Error(
      "Only Paystack payments are supported for refunds",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // TRANSACTION REFERENCE REQUIRED
  // ----------------------------------------------------------

  if (
    !payment.provider_transaction_id
  ) {
    const error = new Error(
      "Paystack transaction reference is missing",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE PROVIDER AMOUNT
  // ----------------------------------------------------------

  const providerAmount =
    Number(payment.provider_amount);

  if (
    !Number.isFinite(providerAmount) ||
    providerAmount <= 0
  ) {
    const error = new Error(
      "Invalid provider payment amount",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE CUSTOMER REFUND AMOUNT
  // ----------------------------------------------------------

  const refundAmount =
    Number(
      payment.customer_total ??
      Number(payment.amount) +
      Number(payment.platform_fee),
    );

  if (
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    const error = new Error(
      "Invalid customer refund amount",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXISTING REFUND
  //
  // payment_refunds has one refund per payment in the current
  // schema. Locking payment above prevents concurrent creation
  // through this function.
  // ----------------------------------------------------------

  const existingRefund =
    await client.query(
      `
      SELECT
        id,
        payment_id,
        dispute_id,
        amount,
        currency,
        status,
        transaction_reference,
        paystack_refund_id,
        expected_at,
        refunded_at,
        failure_reason,
        created_at,
        updated_at

      FROM payment_refunds

      WHERE payment_id = $1

      LIMIT 1
      `,
      [paymentId],
    );

  if (existingRefund.rows.length) {
    const existing =
      existingRefund.rows[0];

    const error = new Error(
      "A refund already exists for this payment",
    );

    error.statusCode = 409;
    error.refund = existing;

    throw error;
  }

  // ----------------------------------------------------------
  // CREATE PROVIDER WALLET IF MISSING
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
    [
      payment.provider_id,
      payment.currency,
    ],
  );

  // ----------------------------------------------------------
  // LOCK PROVIDER WALLET
  // ----------------------------------------------------------

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
      [payment.provider_id],
    );

  if (!walletResult.rows.length) {
    const error = new Error(
      "Provider wallet not found",
    );

    error.statusCode = 500;
    throw error;
  }

  const wallet =
    walletResult.rows[0];

  if (
    wallet.currency !==
    payment.currency
  ) {
    const error = new Error(
      "Provider wallet currency does not match payment currency",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // RESERVE PROVIDER FUNDS
  // ----------------------------------------------------------

  let balanceBefore;
  let balanceAfter;

  if (payment.status === "paid") {
    balanceBefore =
      Number(wallet.pending_balance);

    if (
      balanceBefore <
      providerAmount
    ) {
      const error = new Error(
        "Insufficient pending provider balance for refund",
      );

      error.statusCode = 400;
      throw error;
    }

    balanceAfter =
      balanceBefore -
      providerAmount;

    await client.query(
      `
      UPDATE provider_wallets

      SET
        pending_balance =
          pending_balance - $1,

        updated_at = NOW()

      WHERE id = $2
      `,
      [
        providerAmount,
        wallet.id,
      ],
    );
  } else {
    balanceBefore =
      Number(wallet.available_balance);

    if (
      balanceBefore <
      providerAmount
    ) {
      const error = new Error(
        "Insufficient available provider balance for refund",
      );

      error.statusCode = 400;
      throw error;
    }

    balanceAfter =
      balanceBefore -
      providerAmount;

    await client.query(
      `
      UPDATE provider_wallets

      SET
        available_balance =
          available_balance - $1,

        updated_at = NOW()

      WHERE id = $2
      `,
      [
        providerAmount,
        wallet.id,
      ],
    );
  }

  // ----------------------------------------------------------
  // WALLET RESERVATION LEDGER
  // ----------------------------------------------------------

  const reservationReference =
    `REFUND-RESERVE-${payment.id}`;

  const reservationResult =
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
        payment_id
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

      ON CONFLICT (reference)
      DO NOTHING

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
        reservationReference,
        "Provider funds reserved for customer dispute refund",
        balanceBefore,
        balanceAfter,
        payment.id,
      ],
    );

  // ----------------------------------------------------------
  // CREATE REFUND
  // ----------------------------------------------------------

  const refundResult =
    await client.query(
      `
      INSERT INTO payment_refunds (
        payment_id,
        dispute_id,
        amount,
        currency,
        status,
        transaction_reference
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        'pending',
        $5
      )

      RETURNING
        id,
        payment_id,
        dispute_id,
        amount,
        currency,
        status,
        transaction_reference,
        created_at
      `,
      [
        payment.id,
        disputeId,
        refundAmount,
        payment.currency,
        payment.provider_transaction_id,
      ],
    );

  return {
    refund:
      refundResult.rows[0],

    providerAmount,

    reservationTransaction:
      reservationResult.rows[0] || null,

    payment,

    dispute,
  };
};

// ============================================================
// RESERVE REFUND
// ============================================================
//
// Standalone version.
//
// This function owns its own transaction.
//
// ============================================================

const reserveRefund = async ({
  paymentId,
  disputeId,
  adminId,
}) => {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await reserveRefundInTransaction({
        paymentId,
        disputeId,
        adminId,
        client,
      });

    await client.query("COMMIT");

    return {
      refund:
        result.refund,

      providerAmount:
        result.providerAmount,

      reservationTransaction:
        result.reservationTransaction,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// MARK REFUND NEEDS ATTENTION
// ============================================================
//
// Used when the Paystack request has an ambiguous outcome:
//
// - network timeout
// - connection failure
// - HTTP 5xx
// - gateway failure
//
// IMPORTANT:
// Provider funds remain reserved.
//
// We cannot safely return them because Paystack may have
// accepted the refund even though our request did not receive
// a definitive response.
// ============================================================

const markRefundNeedsAttention = async (
  refundId,
  reason,
) => {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query(
        `
        SELECT
          pr.id,
          pr.status,
          pr.payment_id

        FROM payment_refunds pr

        WHERE pr.id = $1

        FOR UPDATE
        `,
        [refundId],
      );

    if (!result.rows.length) {
      const error = new Error(
        "Refund not found",
      );

      error.statusCode = 404;
      throw error;
    }

    const refund =
      result.rows[0];

    if (
      refund.status ===
      "processed"
    ) {
      await client.query("COMMIT");

      return {
        alreadyProcessed:
          true,

        refundId,
      };
    }

    if (
      refund.status ===
      "failed"
    ) {
      await client.query("COMMIT");

      return {
        alreadyFailed:
          true,

        refundId,
      };
    }

    await client.query(
      `
      UPDATE payment_refunds

      SET
        status = 'needs_attention',

        failure_reason = $1,

        updated_at = NOW()

      WHERE id = $2
      `,
      [
        reason ||
        "Refund request outcome could not be confirmed",
        refundId,
      ],
    );

    await client.query("COMMIT");

    return {
      needsAttention:
        true,

      refundId,

      reason:
        reason ||
        "Refund request outcome could not be confirmed",
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// SUBMIT PAYSTACK REFUND
// ============================================================
//
// IMPORTANT:
//
// This function:
//
// 1. Locks the refund/payment.
// 2. Refuses duplicate external submissions.
// 3. Changes pending -> processing BEFORE calling Paystack.
// 4. Treats definite 4xx failures differently from ambiguous
//    5xx/network failures.
// 5. Does not automatically restore wallet funds for ambiguous
//    outcomes.
// ============================================================

const submitPaystackRefund = async (
  refundId,
) => {
  const client =
    await pool.connect();

  let refund;

  try {
    await client.query("BEGIN");

    const refundResult =
      await client.query(
        `
        SELECT
          pr.id,
          pr.payment_id,
          pr.dispute_id,
          pr.amount,
          pr.currency,
          pr.status,
          pr.transaction_reference,
          pr.paystack_refund_id,
          pr.expected_at,

          p.payment_provider,
          p.provider_id,
          p.status AS payment_status

        FROM payment_refunds pr

        INNER JOIN payments p
          ON p.id = pr.payment_id

        WHERE pr.id = $1

        FOR UPDATE OF pr, p
        `,
        [refundId],
      );

    if (!refundResult.rows.length) {
      const error = new Error(
        "Refund not found",
      );

      error.statusCode = 404;
      throw error;
    }

    refund =
      refundResult.rows[0];

    // --------------------------------------------------------
    // PROCESSED
    // --------------------------------------------------------

    if (
      refund.status ===
      "processed"
    ) {
      await client.query("COMMIT");

      return {
        alreadyProcessed:
          true,

        refund,
      };
    }

    // --------------------------------------------------------
    // FAILED
    // --------------------------------------------------------

    if (
      refund.status ===
      "failed"
    ) {
      await client.query("COMMIT");

      const error = new Error(
        "This refund has already failed and requires review",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // NEEDS ATTENTION
    // --------------------------------------------------------

    if (
      refund.status ===
      "needs_attention"
    ) {
      await client.query("COMMIT");

      const error = new Error(
        "This refund requires attention before it can be completed",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // PROCESSING
    //
    // Another request may already be talking to Paystack.
    //
    // Do NOT submit again.
    // --------------------------------------------------------

    if (
      refund.status ===
      "processing"
    ) {
      await client.query("COMMIT");

      return {
        alreadyProcessing:
          true,

        refund,
      };
    }

    // --------------------------------------------------------
    // MUST BE PENDING
    // --------------------------------------------------------

    if (
      refund.status !==
      "pending"
    ) {
      await client.query("COMMIT");

      const error = new Error(
        `Refund cannot be submitted while status is ${refund.status}`,
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // VALIDATE PROVIDER
    // --------------------------------------------------------

    if (
      refund.payment_provider !==
      "paystack"
    ) {
      await client.query("ROLLBACK");

      const error = new Error(
        "Only Paystack refunds are supported",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // VALIDATE TRANSACTION REFERENCE
    // --------------------------------------------------------

    if (
      !refund.transaction_reference
    ) {
      await client.query("ROLLBACK");

      const error = new Error(
        "Paystack transaction reference is missing for refund",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // VALIDATE REFUND AMOUNT
    // --------------------------------------------------------

    const amountInSubunit =
      Math.round(
        Number(refund.amount) * 100,
      );

    if (
      !Number.isFinite(
        amountInSubunit,
      ) ||
      amountInSubunit <= 0
    ) {
      await client.query("ROLLBACK");

      const error = new Error(
        "Invalid refund amount",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CLAIM REFUND FOR EXTERNAL PROCESSING
    //
    // We commit this state BEFORE the Paystack request.
    //
    // This is deliberate.
    //
    // If the process crashes after this point, another worker
    // can see "processing" and investigate/reconcile rather
    // than blindly submitting another refund.
    // --------------------------------------------------------

    const processingResult =
      await client.query(
        `
        UPDATE payment_refunds

        SET
          status = 'processing',

          updated_at = NOW()

        WHERE id = $1

          AND status = 'pending'

        RETURNING
          id,
          payment_id,
          dispute_id,
          amount,
          currency,
          status,
          transaction_reference,
          paystack_refund_id,
          expected_at
        `,
        [refundId],
      );

    if (
      !processingResult.rows.length
    ) {
      await client.query("COMMIT");

      return {
        alreadyProcessing:
          true,

        refundId,
      };
    }

    refund = {
      ...refund,

      ...processingResult.rows[0],
    };

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    client.release();

    throw error;
  }

  client.release();

  // ==========================================================
  // PAYSTACK EXTERNAL REQUEST
  // ==========================================================

  let response;

  try {
    response = await axios.post(
      "https://api.paystack.co/refund",
      {
        transaction:
          refund.transaction_reference,

        amount:
          Math.round(
            Number(refund.amount) * 100,
          ),

        currency:
          refund.currency,
      },
      {
        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

          "Content-Type":
            "application/json",
        },

        timeout: 15000,
      },
    );
  } catch (error) {
    console.error(
      "Paystack refund error:",
      error.response?.data ||
      error.message,
    );

    const statusCode =
      error.response?.status;

    // --------------------------------------------------------
    // DEFINITE PAYSTACK REJECTION
    //
    // HTTP 4xx means Paystack definitively rejected the
    // request. We can safely restore the reservation.
    // --------------------------------------------------------

    if (
      statusCode >= 400 &&
      statusCode < 500
    ) {
      await failRefund(
        refundId,

        error.response?.data?.message ||
        error.message ||
        "Paystack rejected the refund request",
      );

      const e = new Error(
        error.response?.data?.message ||
        "Paystack rejected the refund request",
      );

      e.statusCode = 502;

      throw e;
    }

    // --------------------------------------------------------
    // AMBIGUOUS OUTCOME
    //
    // Network/timeout/5xx.
    //
    // DO NOT RESTORE FUNDS.
    // --------------------------------------------------------

    await markRefundNeedsAttention(
      refundId,

      error.response?.data?.message ||
      error.message ||
      "Unable to determine whether Paystack accepted the refund request",
    );

    const e = new Error(
      "Refund request outcome could not be confirmed and requires attention",
    );

    e.statusCode = 502;

    throw e;
  }

  // ==========================================================
  // PAYSTACK RESPONSE
  // ==========================================================

  if (
    !response.data?.status ||
    !response.data?.data
  ) {
    await failRefund(
      refundId,
      "Paystack rejected the refund request",
    );

    const error = new Error(
      "Paystack rejected the refund request",
    );

    error.statusCode = 502;

    throw error;
  }

  const data =
    response.data.data;

  const paystackStatus =
    String(
      data.status ||
      "pending",
    ).toLowerCase();

  let localStatus =
    "pending";

  if (
    paystackStatus ===
    "processing"
  ) {
    localStatus =
      "processing";
  }

  if (
    paystackStatus ===
    "needs_attention"
  ) {
    localStatus =
      "needs_attention";
  }

  if (
    paystackStatus ===
    "processed"
  ) {
    localStatus =
      "processed";
  }

  if (
    paystackStatus ===
    "failed"
  ) {
    localStatus =
      "failed";
  }

  // ----------------------------------------------------------
  // SAVE PAYSTACK RESPONSE
  // ----------------------------------------------------------

  await pool.query(
    `
    UPDATE payment_refunds

    SET
      status = $1,

      paystack_refund_id =
        COALESCE(
          $2,
          paystack_refund_id
        ),

      expected_at =
        COALESCE(
          $3,
          expected_at
        ),

      updated_at = NOW()

    WHERE id = $4
    `,
    [
      localStatus,

      data.id
        ? String(data.id)
        : null,

      data.expected_at
        ? new Date(data.expected_at)
        : null,

      refundId,
    ],
  );

  // ----------------------------------------------------------
  // PROCESSED
  // ----------------------------------------------------------

  if (
    localStatus ===
    "processed"
  ) {
    await finalizeProcessedRefund(
      refundId,
    );
  }

  // ----------------------------------------------------------
  // FAILED
  // ----------------------------------------------------------

  if (
    localStatus ===
    "failed"
  ) {
    await failRefund(
      refundId,
      "Paystack marked the refund as failed",
    );
  }

  // ----------------------------------------------------------
  // NEEDS ATTENTION
  // ----------------------------------------------------------

  return {
    refundId,

    status:
      localStatus,

    paystack:
      data,
  };
};

// ============================================================
// FINALIZE PROCESSED REFUND
// ============================================================

const finalizeProcessedRefund =
  async (
    refundId,
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      // ------------------------------------------------------
      // LOCK REFUND + PAYMENT
      // ------------------------------------------------------

      const result =
        await client.query(
          `
          SELECT
            pr.id,
            pr.payment_id,
            pr.dispute_id,
            pr.amount,
            pr.currency,
            pr.status AS refund_status,
            pr.refunded_at,

            p.booking_id,
            p.customer_id,
            p.provider_id,
            p.status AS payment_status,
            p.provider_amount,
            p.provider_transaction_id

          FROM payment_refunds pr

          INNER JOIN payments p
            ON p.id = pr.payment_id

          WHERE pr.id = $1

          FOR UPDATE OF pr, p
          `,
          [refundId],
        );

      if (!result.rows.length) {
        const error = new Error(
          "Refund not found",
        );

        error.statusCode = 404;
        throw error;
      }

      const refund =
        result.rows[0];

      // ------------------------------------------------------
      // ALREADY FINALIZED
      // ------------------------------------------------------

      if (
        refund.refund_status ===
        "processed" &&
        refund.payment_status ===
        "refunded"
      ) {
        const refundTransaction =
          await createPaymentEventTransaction(
            refund,
            "refund",
            Number(refund.amount),
            `REFUND-${refund.provider_transaction_id || refund.payment_id}`,
            client,
          );

        await client.query("COMMIT");

        return {
          alreadyFinalized:
            true,

          refundId,

          paymentTransaction:
            refundTransaction,
        };
      }

      // ------------------------------------------------------
      // DO NOT REVIVE FAILED REFUND
      // ------------------------------------------------------

      if (
        refund.refund_status ===
        "failed"
      ) {
        await client.query(
          "COMMIT",
        );

        return {
          alreadyFailed:
            true,

          refundId,
        };
      }

      // ------------------------------------------------------
      // VALIDATE AMOUNT
      // ------------------------------------------------------

      const refundAmount =
        Number(refund.amount);

      if (
        !Number.isFinite(
          refundAmount,
        ) ||
        refundAmount <= 0
      ) {
        const error = new Error(
          "Invalid processed refund amount",
        );

        error.statusCode = 400;
        throw error;
      }

      // ------------------------------------------------------
      // MARK REFUND PROCESSED
      // ------------------------------------------------------

      await client.query(
        `
        UPDATE payment_refunds

        SET
          status = 'processed',

          refunded_at =
            COALESCE(
              refunded_at,
              NOW()
            ),

          updated_at = NOW()

        WHERE id = $1
        `,
        [refundId],
      );

      // ------------------------------------------------------
      // MARK PAYMENT REFUNDED
      // ------------------------------------------------------

      const paymentResult =
        await client.query(
          `
          UPDATE payments

          SET
            status = 'refunded',

            refunded_at =
              COALESCE(
                refunded_at,
                NOW()
              ),

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
            booking_amount,
            booking_currency,
            provider_currency,
            exchange_rate,
            checkout_url,
            checkout_access_code,
            created_at,
            updated_at
          `,
          [refund.payment_id],
        );

      if (!paymentResult.rows.length) {
        const error = new Error(
          "Payment not found while finalizing refund",
        );

        error.statusCode = 404;
        throw error;
      }

      const refundedPayment =
        paymentResult.rows[0];

      // ------------------------------------------------------
      // MARK BOOKING REFUNDED
      // ------------------------------------------------------

      await client.query(
        `
        UPDATE bookings

        SET
          status = 'refunded'

        WHERE id = $1
        `,
        [refund.booking_id],
      );

      // ------------------------------------------------------
      // REFUND PAYMENT LEDGER
      // ------------------------------------------------------

      const refundTransaction =
        await createPaymentEventTransaction(
          refundedPayment,
          "refund",
          refundAmount,
          `REFUND-${refundedPayment.provider_transaction_id || refundedPayment.id}`,
          client,
        );

      await client.query("COMMIT");

      // ------------------------------------------------------
      // NOTIFY CUSTOMER
      // ------------------------------------------------------

      await sendNotification({
        userId:
          refundedPayment.customer_id,

        type:
          "payment_refunded",

        title:
          "Payment Refunded",

        message:
          `Your refund of ₦${Number(
            refundAmount,
          ).toLocaleString()} has been processed successfully.`,

        actionUrl:
          `/payments/${refundedPayment.id}`,
      });

      // ------------------------------------------------------
      // NOTIFY PROVIDER
      // ------------------------------------------------------

      await sendNotification({
        userId:
          refundedPayment.provider_id,

        type:
          "payment_refunded",

        title:
          "Payment Refunded",

        message:
          `₦${Number(
            refundedPayment.provider_amount,
          ).toLocaleString()} has been deducted from your wallet following the completed refund.`,

        actionUrl:
          "/wallet",
      });

      return {
        finalized:
          true,

        refundId,

        paymentTransaction:
          refundTransaction,
      };
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (_) { }

      throw error;
    } finally {
      client.release();
    }
  };

// ============================================================
// FAIL REFUND + RESTORE WALLET
// ============================================================

const failRefund = async (
  refundId,
  reason,
) => {
  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // LOCK REFUND + PAYMENT
    // --------------------------------------------------------

    const result =
      await client.query(
        `
        SELECT
          pr.id,
          pr.payment_id,
          pr.status AS refund_status,
          pr.dispute_id,

          p.booking_id,
          p.provider_id,
          p.provider_amount,
          p.currency,
          p.status AS payment_status

        FROM payment_refunds pr

        INNER JOIN payments p
          ON p.id = pr.payment_id

        WHERE pr.id = $1

        FOR UPDATE OF pr, p
        `,
        [refundId],
      );

    if (!result.rows.length) {
      const error = new Error(
        "Refund not found",
      );

      error.statusCode = 404;
      throw error;
    }

    const refund =
      result.rows[0];

    // --------------------------------------------------------
    // ALREADY PROCESSED
    // --------------------------------------------------------

    if (
      refund.refund_status ===
      "processed"
    ) {
      await client.query(
        "COMMIT",
      );

      return {
        alreadyProcessed:
          true,

        refundId,
      };
    }

    // --------------------------------------------------------
    // CHECK WHETHER WALLET WAS ALREADY RESTORED
    // --------------------------------------------------------

    const existingReturn =
      await client.query(
        `
        SELECT
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
          created_at

        FROM wallet_transactions

        WHERE payment_id = $1
          AND reference = $2

        LIMIT 1
        `,
        [
          refund.payment_id,

          `REFUND-RETURN-${refund.payment_id}`,
        ],
      );

    // --------------------------------------------------------
    // RESTORE PROVIDER FUNDS ONLY ONCE
    // --------------------------------------------------------

    if (
      !existingReturn.rows.length
    ) {
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
        [
          refund.provider_id,
          refund.currency,
        ],
      );

      const walletResult =
        await client.query(
          `
          SELECT
            id,
            provider_id,
            available_balance,
            pending_balance,
            currency

          FROM provider_wallets

          WHERE provider_id = $1

          FOR UPDATE
          `,
          [refund.provider_id],
        );

      if (!walletResult.rows.length) {
        const error = new Error(
          "Provider wallet not found while restoring refund reservation",
        );

        error.statusCode = 500;
        throw error;
      }

      const wallet =
        walletResult.rows[0];

      if (
        wallet.currency !==
        refund.currency
      ) {
        const error = new Error(
          "Provider wallet currency does not match refund currency",
        );

        error.statusCode = 400;
        throw error;
      }

      const amount =
        Number(
          refund.provider_amount,
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        const error = new Error(
          "Invalid provider refund restoration amount",
        );

        error.statusCode = 400;
        throw error;
      }

      // ------------------------------------------------------
      // ORIGINAL PAYMENT WAS PAID
      // RETURN TO PENDING
      // ------------------------------------------------------

      if (
        refund.payment_status ===
        "paid"
      ) {
        const before =
          Number(
            wallet.pending_balance,
          );

        const after =
          before + amount;

        await client.query(
          `
          UPDATE provider_wallets

          SET
            pending_balance =
              pending_balance + $1,

            updated_at = NOW()

          WHERE id = $2
          `,
          [
            amount,
            wallet.id,
          ],
        );

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
            payment_id
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

          ON CONFLICT (reference)
          DO NOTHING
          `,
          [
            refund.provider_id,
            amount,
            refund.currency,
            `REFUND-RETURN-${refund.payment_id}`,
            "Refund reservation returned after failed Paystack refund",
            before,
            after,
            refund.payment_id,
          ],
        );
      }

      // ------------------------------------------------------
      // ORIGINAL PAYMENT WAS RELEASED
      // RETURN TO AVAILABLE
      // ------------------------------------------------------

      else if (
        refund.payment_status ===
        "released"
      ) {
        const before =
          Number(
            wallet.available_balance,
          );

        const after =
          before + amount;

        await client.query(
          `
          UPDATE provider_wallets

          SET
            available_balance =
              available_balance + $1,

            updated_at = NOW()

          WHERE id = $2
          `,
          [
            amount,
            wallet.id,
          ],
        );

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
            payment_id
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

          ON CONFLICT (reference)
          DO NOTHING
          `,
          [
            refund.provider_id,
            amount,
            refund.currency,
            `REFUND-RETURN-${refund.payment_id}`,
            "Refund reservation returned after failed Paystack refund",
            before,
            after,
            refund.payment_id,
          ],
        );
      }

      else {
        const error = new Error(
          `Cannot restore refund reservation while payment status is ${refund.payment_status}`,
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // --------------------------------------------------------
    // MARK REFUND FAILED
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE payment_refunds

      SET
        status = 'failed',

        failure_reason = $1,

        updated_at = NOW()

      WHERE id = $2

        AND status <> 'processed'
      `,
      [
        reason ||
        "Refund failed",

        refundId,
      ],
    );

    // --------------------------------------------------------
    // REOPEN DISPUTE
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE disputes

      SET
        status = 'under_review'

      WHERE id = $1

        AND status <> 'closed'
      `,
      [refund.dispute_id],
    );

    // --------------------------------------------------------
    // RETURN BOOKING TO DISPUTED
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE bookings

      SET
        status = 'disputed'

      WHERE id = $1
      `,
      [refund.booking_id],
    );

    await client.query(
      "COMMIT",
    );

    return {
      failed:
        true,

      refundId,

      reason,
    };
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      );
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// PROCESS REFUND WEBHOOK
// ============================================================

const processRefundWebhook = async (
  event,
  data,
) => {
  const transactionReference =
    data?.transaction_reference ||
    data?.transaction ||
    data?.reference ||
    null;

  const paystackRefundId =
    data?.id
      ? String(data.id)
      : null;

  let result = null;

  // ----------------------------------------------------------
  // FIND BY PAYSTACK REFUND ID
  // ----------------------------------------------------------

  if (paystackRefundId) {
    result =
      await pool.query(
        `
        SELECT
          id,
          status

        FROM payment_refunds

        WHERE paystack_refund_id = $1

        LIMIT 1
        `,
        [paystackRefundId],
      );
  }

  // ----------------------------------------------------------
  // FALL BACK TO TRANSACTION REFERENCE
  // ----------------------------------------------------------

  if (
    (!result ||
      !result.rows.length) &&
    transactionReference
  ) {
    result =
      await pool.query(
        `
        SELECT
          id,
          status

        FROM payment_refunds

        WHERE transaction_reference = $1

        LIMIT 1
        `,
        [transactionReference],
      );
  }

  if (
    !result ||
    !result.rows.length
  ) {
    console.error(
      "Refund webhook could not find local refund:",
      {
        event,

        paystackRefundId,

        transactionReference,
      },
    );

    return {
      found:
        false,
    };
  }

  const refundId =
    result.rows[0].id;

  const currentStatus =
    result.rows[0].status;

  // ----------------------------------------------------------
  // MAP PAYSTACK EVENT
  // ----------------------------------------------------------

  let status =
    "pending";

  switch (event) {
    case "refund.pending":
      status = "pending";
      break;

    case "refund.processing":
      status = "processing";
      break;

    case "refund.needs_attention":
      status =
        "needs_attention";
      break;

    case "refund.processed":
      status =
        "processed";
      break;

    case "refund.failed":
      status =
        "failed";
      break;

    default:
      return {
        found:
          true,

        ignored:
          true,

        refundId,
      };
  }

  // ----------------------------------------------------------
  // DO NOT RESURRECT FAILED REFUND
  // ----------------------------------------------------------

  if (
    currentStatus === "failed" &&
    status === "processed"
  ) {
    console.warn(
      "Ignoring processed webhook for an already failed refund:",
      refundId,
    );

    return {
      found:
        true,

      ignored:
        true,

      refundId,

      status:
        currentStatus,
    };
  }

  // ----------------------------------------------------------
  // DO NOT MOVE PROCESSED REFUND BACKWARD
  // ----------------------------------------------------------

  if (
    currentStatus ===
    "processed" &&
    status !==
    "processed"
  ) {
    return {
      found:
        true,

      ignored:
        true,

      refundId,

      status:
        currentStatus,
    };
  }

  // ----------------------------------------------------------
  // DO NOT MOVE NEEDS_ATTENTION BACK TO PENDING
  // AUTOMATICALLY
  // ----------------------------------------------------------
  //
  // A needs_attention refund requires reconciliation.
  //
  // A later processed webhook is still accepted.
  //
  // A failed webhook is also accepted.
  //
  // But pending/processing should not silently reset it.
  // ----------------------------------------------------------

  if (
    currentStatus ===
    "needs_attention" &&
    status === "pending"
  ) {
    return {
      found:
        true,

      ignored:
        true,

      refundId,

      status:
        currentStatus,
    };
  }

  // ----------------------------------------------------------
  // UPDATE LOCAL REFUND STATUS
  // ----------------------------------------------------------

  await pool.query(
    `
    UPDATE payment_refunds

    SET
      status = $1,

      paystack_refund_id =
        COALESCE(
          $2,
          paystack_refund_id
        ),

      expected_at =
        COALESCE(
          $3,
          expected_at
        ),

      updated_at = NOW()

    WHERE id = $4
    `,
    [
      status,

      paystackRefundId,

      data?.expected_at
        ? new Date(
          data.expected_at,
        )
        : null,

      refundId,
    ],
  );

  // ----------------------------------------------------------
  // PROCESSED
  // ----------------------------------------------------------

  if (
    status ===
    "processed"
  ) {
    await finalizeProcessedRefund(
      refundId,
    );
  }

  // ----------------------------------------------------------
  // FAILED
  // ----------------------------------------------------------

  if (
    status ===
    "failed"
  ) {
    await failRefund(
      refundId,

      data?.failure_reason ||
      data?.message ||
      "Paystack refund failed",
    );
  }

  return {
    found:
      true,

    refundId,

    status,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  calculatePlatformFee,

  getBookingPaymentDetails,

  getMyPayments,

  initializePaystackTransaction,

  createPayment,

  creditProviderPendingWallet,

  releasePayment,

  releasePaymentInTransaction,

  createPaymentTransaction,

  createPaymentEventTransaction,

  processSuccessfulPayment,

  verifyPayment,

  reserveRefund,

  reserveRefundInTransaction,

  submitPaystackRefund,

  finalizeProcessedRefund,

  failRefund,

  processRefundWebhook,
};
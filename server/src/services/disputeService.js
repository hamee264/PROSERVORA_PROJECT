const pool = require("../config/database");
const { createNotification } = require("./notificationService");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const USER_DISPUTE_COLUMNS = `
  d.id,
  d.booking_id,
  d.opened_by,
  d.reason,
  d.description,
  d.status,
  d.resolution,
  d.previous_booking_status,
  d.resolution_type,
  d.created_at,
  d.resolved_at
`;

// ============================================================
// CREATE DISPUTE
// ============================================================

const createDispute = async ({
  bookingId,
  userId,
  reason,
  description,
}) => {
  const cleanReason = String(reason || "").trim();
  const cleanDescription = String(description || "").trim();

  if (!bookingId) {
    throw createError("Booking ID is required", 400);
  }

  if (!userId) {
    throw createError("User authentication is required", 401);
  }

  if (!cleanReason) {
    throw createError("Dispute reason is required", 400);
  }

  if (!cleanDescription) {
    throw createError("Dispute description is required", 400);
  }

  if (cleanReason.length > 150) {
    throw createError(
      "Dispute reason cannot exceed 150 characters",
      400,
    );
  }

  if (cleanDescription.length > 5000) {
    throw createError(
      "Dispute description cannot exceed 5000 characters",
      400,
    );
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
        id,
        customer_id,
        provider_id,
        status,
        agreed_amount,
        currency
      FROM bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [bookingId],
    );

    if (bookingResult.rows.length === 0) {
      throw createError("Booking not found", 404);
    }

    const booking = bookingResult.rows[0];

    // --------------------------------------------------------
    // CHECK USER IS PART OF BOOKING
    // --------------------------------------------------------

    const isCustomer = booking.customer_id === userId;
    const isProvider = booking.provider_id === userId;

    if (!isCustomer && !isProvider) {
      throw createError(
        "You are not authorized to dispute this booking",
        403,
      );
    }

    // --------------------------------------------------------
    // CHECK BOOKING STATUS
    // --------------------------------------------------------

    const disputableStatuses = [
      "accepted",
      "in_progress",
      "completed",
    ];

    if (!disputableStatuses.includes(booking.status)) {
      throw createError(
        "This booking cannot currently be disputed",
        400,
      );
    }

    // --------------------------------------------------------
    // CHECK ACTIVE DISPUTE
    // --------------------------------------------------------
    //
    // The database also has:
    //
    // uq_disputes_active_booking
    //
    // which provides the final race-condition protection.
    // --------------------------------------------------------

    const existingResult = await client.query(
      `
      SELECT
        id,
        status
      FROM disputes
      WHERE booking_id = $1
        AND status IN ('open', 'under_review')
      LIMIT 1
      `,
      [bookingId],
    );

    if (existingResult.rows.length > 0) {
      throw createError(
        "This booking already has an active dispute",
        409,
      );
    }

    // --------------------------------------------------------
    // CREATE DISPUTE
    // --------------------------------------------------------

    let dispute;

    try {
      const disputeResult = await client.query(
        `
        INSERT INTO disputes (
          booking_id,
          opened_by,
          reason,
          description,
          status,
          previous_booking_status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'open',
          $5
        )
        RETURNING
          id,
          booking_id,
          opened_by,
          reason,
          description,
          status,
          resolution,
          previous_booking_status,
          resolution_type,
          created_at,
          resolved_at
        `,
        [
          bookingId,
          userId,
          cleanReason,
          cleanDescription,
          booking.status,
        ],
      );

      dispute = disputeResult.rows[0];
    } catch (error) {
      // ------------------------------------------------------
      // DATABASE-LEVEL ACTIVE DISPUTE PROTECTION
      // ------------------------------------------------------

      if (
        error.code === "23505" &&
        error.constraint === "uq_disputes_active_booking"
      ) {
        throw createError(
          "This booking already has an active dispute",
          409,
        );
      }

      throw error;
    }

    // --------------------------------------------------------
    // MARK BOOKING AS DISPUTED
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE bookings
      SET status = 'disputed'
      WHERE id = $1
      `,
      [bookingId],
    );

    // --------------------------------------------------------
    // NOTIFY OTHER PARTY
    // --------------------------------------------------------

    const receiverId = isCustomer
      ? booking.provider_id
      : booking.customer_id;

    await createNotification({
      userId: receiverId,
      type: "dispute_opened",
      title: "New dispute opened",
      message:
        "A dispute has been opened for one of your bookings.",
      actionUrl: `/dashboard/disputes/${dispute.id}`,
      client,
    });

    await client.query("COMMIT");

    return dispute;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Dispute rollback error:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// GET MY DISPUTES
// ============================================================

const getMyDisputes = async (userId) => {
  if (!userId) {
    throw createError("User authentication is required", 401);
  }

  const result = await pool.query(
    `
    SELECT
      ${USER_DISPUTE_COLUMNS},

      b.customer_id,
      b.provider_id,
      b.agreed_amount,
      b.currency,
      b.status AS booking_status,

      p.id AS payment_id,
      p.amount AS payment_amount,
      p.customer_total,
      p.provider_amount,
      p.status AS payment_status,

      pr.id AS refund_id,
      pr.amount AS refund_amount,
      pr.currency AS refund_currency,
      pr.status AS refund_status,
      pr.paystack_refund_id,
      pr.transaction_reference,
      pr.customer_note,
      pr.expected_at,
      pr.refunded_at,
      pr.failure_reason

    FROM disputes d

    INNER JOIN bookings b
      ON b.id = d.booking_id

    LEFT JOIN payments p
      ON p.booking_id = b.id

    LEFT JOIN payment_refunds pr
      ON pr.payment_id = p.id

    WHERE
      b.customer_id = $1
      OR b.provider_id = $1

    ORDER BY d.created_at DESC
    `,
    [userId],
  );

  return result.rows;
};

// ============================================================
// GET SINGLE DISPUTE
// ============================================================

const getDisputeForUser = async (
  disputeId,
  userId,
) => {
  if (!disputeId) {
    throw createError("Dispute ID is required", 400);
  }

  if (!userId) {
    throw createError("User authentication is required", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET DISPUTE + VERIFY PARTICIPANT
    // --------------------------------------------------------

    const result = await client.query(
      `
      SELECT
        ${USER_DISPUTE_COLUMNS},

        b.customer_id,
        b.provider_id,
        b.agreed_amount,
        b.currency,
        b.status AS booking_status,

        p.id AS payment_id,
        p.amount AS payment_amount,
        p.platform_fee,
        p.customer_total,
        p.provider_amount,
        p.status AS payment_status,
        p.provider_transaction_id,

        pr.id AS refund_id,
        pr.amount AS refund_amount,
        pr.currency AS refund_currency,
        pr.status AS refund_status,
        pr.paystack_refund_id,
        pr.transaction_reference,
        pr.customer_note,
        pr.expected_at,
        pr.refunded_at,
        pr.failure_reason

      FROM disputes d

      INNER JOIN bookings b
        ON b.id = d.booking_id

      LEFT JOIN payments p
        ON p.booking_id = b.id

      LEFT JOIN payment_refunds pr
        ON pr.payment_id = p.id

      WHERE
        d.id = $1
        AND (
          b.customer_id = $2
          OR b.provider_id = $2
        )

      LIMIT 1
      `,
      [disputeId, userId],
    );

    if (result.rows.length === 0) {
      throw createError("Dispute not found", 404);
    }

    const dispute = result.rows[0];

    // --------------------------------------------------------
    // GET DISPUTE MESSAGES
    // --------------------------------------------------------

    const messagesResult = await client.query(
      `
      SELECT
        dm.id,
        dm.dispute_id,
        dm.user_id,
        dm.message,
        dm.is_admin,
        dm.created_at,

        u.first_name,
        u.last_name,
        u.role

      FROM dispute_messages dm

      INNER JOIN users u
        ON u.id = dm.user_id

      WHERE dm.dispute_id = $1

      ORDER BY dm.created_at ASC
      `,
      [disputeId],
    );

    await client.query("COMMIT");

    return {
      ...dispute,
      messages: messagesResult.rows,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Get dispute rollback error:",
        rollbackError,
      );
    }

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// ADD USER DISPUTE MESSAGE
// ============================================================

const addDisputeMessage = async ({
  disputeId,
  userId,
  message,
}) => {
  const cleanMessage = String(message || "").trim();

  if (!disputeId) {
    throw createError("Dispute ID is required", 400);
  }

  if (!userId) {
    throw createError("User authentication is required", 401);
  }

  if (!cleanMessage) {
    throw createError("Message is required", 400);
  }

  if (cleanMessage.length > 5000) {
    throw createError(
      "Message cannot exceed 5000 characters",
      400,
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // LOCK DISPUTE + VERIFY PARTICIPANT
    // --------------------------------------------------------

    const result = await client.query(
      `
      SELECT
        d.id,
        d.status,
        b.customer_id,
        b.provider_id
      FROM disputes d

      INNER JOIN bookings b
        ON b.id = d.booking_id

      WHERE d.id = $1

      FOR UPDATE
      `,
      [disputeId],
    );

    if (result.rows.length === 0) {
      throw createError("Dispute not found", 404);
    }

    const dispute = result.rows[0];

    // --------------------------------------------------------
    // CHECK USER IS PARTICIPANT
    // --------------------------------------------------------

    const isParticipant =
      dispute.customer_id === userId ||
      dispute.provider_id === userId;

    if (!isParticipant) {
      throw createError(
        "You are not authorized to respond to this dispute",
        403,
      );
    }

    // --------------------------------------------------------
    // CHECK DISPUTE STATUS
    // --------------------------------------------------------

    if (
      dispute.status !== "open" &&
      dispute.status !== "under_review"
    ) {
      throw createError(
        "This dispute is no longer accepting messages",
        400,
      );
    }

    // --------------------------------------------------------
    // CREATE MESSAGE
    // --------------------------------------------------------

    const messageResult = await client.query(
      `
      INSERT INTO dispute_messages (
        dispute_id,
        user_id,
        message,
        is_admin
      )
      VALUES (
        $1,
        $2,
        $3,
        false
      )
      RETURNING
        id,
        dispute_id,
        user_id,
        message,
        is_admin,
        created_at
      `,
      [disputeId, userId, cleanMessage],
    );

    // --------------------------------------------------------
    // NOTIFY OTHER PARTICIPANT
    // --------------------------------------------------------

    const receiverId =
      dispute.customer_id === userId
        ? dispute.provider_id
        : dispute.customer_id;

    await createNotification({
      userId: receiverId,
      type: "dispute_message",
      title: "New dispute message",
      message:
        "You have received a new message regarding an active dispute.",
      actionUrl: `/dashboard/disputes/${disputeId}`,
      client,
    });

    await client.query("COMMIT");

    return messageResult.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Dispute message rollback error:",
        rollbackError,
      );
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
  createDispute,
  getMyDisputes,
  getDisputeForUser,
  addDisputeMessage,
};
const pool = require("../config/database");
const { createNotification } = require("./notificationService");

// ============================================================
// CREATE DISPUTE
// ============================================================

const createDispute = async ({ bookingId, userId, reason, description }) => {
  const cleanReason = String(reason || "").trim();
  const cleanDescription = String(description || "").trim();

  if (!bookingId) {
    const error = new Error("Booking ID is required");
    error.statusCode = 400;
    throw error;
  }

  if (!cleanReason) {
    const error = new Error("Dispute reason is required");
    error.statusCode = 400;
    throw error;
  }

  if (!cleanDescription) {
    const error = new Error("Dispute description is required");
    error.statusCode = 400;
    throw error;
  }

  if (cleanReason.length > 150) {
    const error = new Error("Dispute reason cannot exceed 150 characters");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET BOOKING
    // --------------------------------------------------------

    const bookingResult = await client.query(
      `
      SELECT
        id,
        customer_id,
        provider_id,
        status,
        agreed_amount
      FROM bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [bookingId],
    );

    if (bookingResult.rows.length === 0) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = bookingResult.rows[0];

    // --------------------------------------------------------
    // CHECK USER IS PART OF BOOKING
    // --------------------------------------------------------

    const isCustomer = booking.customer_id === userId;
    const isProvider = booking.provider_id === userId;

    if (!isCustomer && !isProvider) {
      const error = new Error("You are not authorized to dispute this booking");
      error.statusCode = 403;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK BOOKING STATUS
    // --------------------------------------------------------

    if (
      booking.status !== "completed" &&
      booking.status !== "in_progress" &&
      booking.status !== "accepted"
    ) {
      const error = new Error("This booking cannot currently be disputed");
      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK EXISTING ACTIVE DISPUTE
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
      const error = new Error("This booking already has an active dispute");
      error.statusCode = 409;
      throw error;
    }

    // --------------------------------------------------------
    // CREATE DISPUTE
    // --------------------------------------------------------

    const disputeResult = await client.query(
      `
      INSERT INTO disputes (
        booking_id,
        opened_by,
        reason,
        description,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'open'
      )
      RETURNING
        id,
        booking_id,
        opened_by,
        reason,
        description,
        status,
        resolution,
        created_at,
        resolved_at
      `,
      [bookingId, userId, cleanReason, cleanDescription],
    );

    const dispute = disputeResult.rows[0];

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

    const receiverId = isCustomer ? booking.provider_id : booking.customer_id;

    await createNotification({
      userId: receiverId,
      type: "dispute_opened",
      title: "New dispute opened",
      message: "A dispute has been opened for one of your bookings.",
      actionUrl: `/dashboard/disputes/${dispute.id}`,
      client,
    });

    await client.query("COMMIT");

    return dispute;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Dispute rollback error:", rollbackError);
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
  const result = await pool.query(
    `
    SELECT
      d.id,
      d.booking_id,
      d.opened_by,
      d.reason,
      d.description,
      d.status,
      d.resolution,
      d.created_at,
      d.resolved_at,

      b.customer_id,
      b.provider_id,
      b.agreed_amount,
      b.currency,
      b.status AS booking_status

    FROM disputes d

    INNER JOIN bookings b
      ON b.id = d.booking_id

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

const getDisputeForUser = async (disputeId, userId) => {
  const result = await pool.query(
    `
    SELECT
      d.id,
      d.booking_id,
      d.opened_by,
      d.reason,
      d.description,
      d.status,
      d.resolution,
      d.created_at,
      d.resolved_at,

      b.customer_id,
      b.provider_id,
      b.agreed_amount,
      b.currency,
      b.status AS booking_status

    FROM disputes d

    INNER JOIN bookings b
      ON b.id = d.booking_id

    WHERE
      d.id = $1
      AND (
        b.customer_id = $2
        OR b.provider_id = $2
      )
    `,
    [disputeId, userId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Dispute not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createDispute,
  getMyDisputes,
  getDisputeForUser,
};

const pool = require("../config/database");
const notificationService = require("./notificationService");

// ============================================================
// SAFE NOTIFICATION HELPER
// ============================================================
// Notification failure should not break the main booking action.
// The booking/payment/etc. action remains successful even if
// notification creation temporarily fails.
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
    console.error("Notification error:", error);
  }
};

// ============================================================
// CREATE BOOKING / PROVIDER APPLICATION
// ============================================================

const createBooking = async (providerId, data) => {
  const { opportunityId, serviceId, agreedAmount } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!opportunityId || !serviceId || agreedAmount === undefined) {
    const error = new Error(
      "Opportunity, service and agreed amount are required",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE AMOUNT
  // ----------------------------------------------------------

  const amount = Number(agreedAmount);

  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("Agreed amount must be a valid positive number");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK OPPORTUNITY
  // ----------------------------------------------------------

  const opportunityResult = await pool.query(
    `
    SELECT
      o.id,
      o.customer_id,
      o.category_id,
      o.status,
      o.expires_at
    FROM opportunities o
    WHERE o.id = $1
    `,
    [opportunityId],
  );

  if (opportunityResult.rows.length === 0) {
    const error = new Error("Opportunity not found");

    error.statusCode = 404;
    throw error;
  }

  const opportunity = opportunityResult.rows[0];

  // ----------------------------------------------------------
  // CHECK OPPORTUNITY STATUS
  // ----------------------------------------------------------

  if (opportunity.status !== "open") {
    const error = new Error("This opportunity is no longer open");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK EXPIRATION
  // ----------------------------------------------------------

  if (new Date(opportunity.expires_at) <= new Date()) {
    const error = new Error("This opportunity has expired");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK PROVIDER
  // ----------------------------------------------------------

  const providerResult = await pool.query(
    `
    SELECT id
    FROM users
    WHERE id = $1
      AND role = 'provider'
      AND is_active = true
    `,
    [providerId],
  );

  if (providerResult.rows.length === 0) {
    const error = new Error("Provider account not found");

    error.statusCode = 404;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK SERVICE
  // ----------------------------------------------------------

  const serviceResult = await pool.query(
    `
    SELECT
      id,
      provider_id,
      category_id,
      is_active
    FROM services
    WHERE id = $1
    `,
    [serviceId],
  );

  if (serviceResult.rows.length === 0) {
    const error = new Error("Service not found");

    error.statusCode = 404;
    throw error;
  }

  const service = serviceResult.rows[0];

  // ----------------------------------------------------------
  // CHECK SERVICE OWNERSHIP
  // ----------------------------------------------------------

  if (service.provider_id !== providerId) {
    const error = new Error("You can only use your own service");

    error.statusCode = 403;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK SERVICE STATUS
  // ----------------------------------------------------------

  if (!service.is_active) {
    const error = new Error("This service is currently inactive");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK CATEGORY MATCH
  // ----------------------------------------------------------

  if (service.category_id !== opportunity.category_id) {
    const error = new Error(
      "Your service category does not match this opportunity",
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CHECK DUPLICATE APPLICATION
  // ----------------------------------------------------------

  const duplicateResult = await pool.query(
    `
    SELECT id
    FROM bookings
    WHERE opportunity_id = $1
      AND provider_id = $2
      AND status NOT IN ('cancelled', 'refunded')
    `,
    [opportunityId, providerId],
  );

  if (duplicateResult.rows.length > 0) {
    const error = new Error("You have already applied to this opportunity");

    error.statusCode = 409;
    throw error;
  }

  // ----------------------------------------------------------
  // CREATE BOOKING
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    INSERT INTO bookings (
      opportunity_id,
      customer_id,
      provider_id,
      service_id,
      agreed_amount,
      currency,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'NGN', 'pending')

    RETURNING
      id,
      opportunity_id,
      customer_id,
      provider_id,
      service_id,
      agreed_amount,
      currency,
      status,
      started_at,
      completed_at,
      created_at,
      updated_at
    `,
    [opportunityId, opportunity.customer_id, providerId, serviceId, amount],
  );

  const booking = result.rows[0];

  // ----------------------------------------------------------
  // NOTIFY CUSTOMER
  // ----------------------------------------------------------

  await sendNotification({
    userId: opportunity.customer_id,
    type: "booking_application",
    title: "New Booking Application",
    message: "A provider has applied to your opportunity.",
    actionUrl: `/bookings/${booking.id}`,
  });

  return booking;
};

// ============================================================
// GET MY BOOKINGS
// ============================================================

const getMyBookings = async (userId, role) => {
  let query;

  if (role === "customer") {
    query = `
      SELECT
        b.id,
        b.opportunity_id,
        b.customer_id,
        b.provider_id,
        b.service_id,

        b.agreed_amount,
        b.currency,
        b.status,

        b.started_at,
        b.completed_at,
        b.created_at,
        b.updated_at,

        o.title AS opportunity_title,
        o.description AS opportunity_description,
        o.location_text AS opportunity_location,

        s.title AS service_title,
        s.description AS service_description,

        p.first_name AS provider_first_name,
        p.last_name AS provider_last_name,
        p.username AS provider_username,
        p.phone AS provider_phone,
        p.avatar_url AS provider_avatar_url

      FROM bookings b

      INNER JOIN opportunities o
        ON o.id = b.opportunity_id

      INNER JOIN services s
        ON s.id = b.service_id

      INNER JOIN profiles p
        ON p.user_id = b.provider_id

      WHERE b.customer_id = $1

      ORDER BY b.created_at DESC
    `;
  } else if (role === "provider") {
    query = `
      SELECT
        b.id,
        b.opportunity_id,
        b.customer_id,
        b.provider_id,
        b.service_id,

        b.agreed_amount,
        b.currency,
        b.status,

        b.started_at,
        b.completed_at,
        b.created_at,
        b.updated_at,

        o.title AS opportunity_title,
        o.description AS opportunity_description,
        o.location_text AS opportunity_location,

        s.title AS service_title,
        s.description AS service_description,

        p.first_name AS customer_first_name,
        p.last_name AS customer_last_name,
        p.username AS customer_username,
        p.phone AS customer_phone,
        p.avatar_url AS customer_avatar_url

      FROM bookings b

      INNER JOIN opportunities o
        ON o.id = b.opportunity_id

      INNER JOIN services s
        ON s.id = b.service_id

      INNER JOIN profiles p
        ON p.user_id = b.customer_id

      WHERE b.provider_id = $1

      ORDER BY b.created_at DESC
    `;
  } else {
    const error = new Error("Unsupported user role");

    error.statusCode = 403;

    throw error;
  }

  const result = await pool.query(query, [userId]);

  return result.rows;
};

// ============================================================
// ACCEPT BOOKING APPLICATION
// ============================================================

const acceptBooking = async (providerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET + LOCK BOOKING
    // --------------------------------------------------------

    const bookingResult = await client.query(
      `
      SELECT
        b.id,
        b.opportunity_id,
        b.customer_id,
        b.provider_id,
        b.service_id,
        b.agreed_amount,
        b.currency,
        b.status,

        o.status AS opportunity_status,
        o.expires_at

      FROM bookings b

      INNER JOIN opportunities o
        ON o.id = b.opportunity_id

      WHERE b.id = $1
        AND b.provider_id = $2

      FOR UPDATE OF b, o
      `,
      [bookingId, providerId],
    );

    if (bookingResult.rows.length === 0) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = bookingResult.rows[0];

    // --------------------------------------------------------
    // CHECK BOOKING STATUS
    // --------------------------------------------------------

    if (booking.status !== "pending") {
      const error = new Error(
        `Booking cannot be accepted because it is already ${booking.status}`,
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK OPPORTUNITY STATUS
    // --------------------------------------------------------

    if (booking.opportunity_status !== "open") {
      const error = new Error("This opportunity is no longer open");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK EXPIRATION
    // --------------------------------------------------------

    if (new Date(booking.expires_at) <= new Date()) {
      const error = new Error("This opportunity has expired");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // ACCEPT SELECTED BOOKING
    // --------------------------------------------------------

    const acceptedResult = await client.query(
      `
      UPDATE bookings
      SET
        status = 'accepted'
      WHERE id = $1
        AND provider_id = $2
        AND status = 'pending'

      RETURNING
        id,
        opportunity_id,
        customer_id,
        provider_id,
        service_id,
        agreed_amount,
        currency,
        status,
        started_at,
        completed_at,
        created_at,
        updated_at
      `,
      [bookingId, providerId],
    );

    if (acceptedResult.rows.length === 0) {
      const error = new Error("Unable to accept booking");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // MARK OPPORTUNITY AS TAKEN
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE opportunities
      SET
        status = 'taken'
      WHERE id = $1
        AND status = 'open'
      `,
      [booking.opportunity_id],
    );

    // --------------------------------------------------------
    // FIND OTHER PENDING APPLICATIONS
    // --------------------------------------------------------

    const otherApplicationsResult = await client.query(
      `
      SELECT
        id,
        provider_id
      FROM bookings
      WHERE opportunity_id = $1
        AND id != $2
        AND status = 'pending'
      `,
      [booking.opportunity_id, booking.id],
    );

    // --------------------------------------------------------
    // CANCEL OTHER PENDING APPLICATIONS
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE bookings
      SET
        status = 'cancelled'
      WHERE opportunity_id = $1
        AND id != $2
        AND status = 'pending'
      `,
      [booking.opportunity_id, booking.id],
    );

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    const acceptedBooking = acceptedResult.rows[0];

    // --------------------------------------------------------
    // NOTIFY CUSTOMER
    // --------------------------------------------------------

    await sendNotification({
      userId: acceptedBooking.customer_id,
      type: "booking_accepted",
      title: "Booking Accepted",
      message: "A provider has accepted your booking request.",
      actionUrl: `/bookings/${acceptedBooking.id}`,
    });

    // --------------------------------------------------------
    // NOTIFY OTHER PROVIDERS
    // --------------------------------------------------------

    for (const application of otherApplicationsResult.rows) {
      await sendNotification({
        userId: application.provider_id,
        type: "booking_cancelled",
        title: "Application Not Selected",
        message: "Another provider was selected for this opportunity.",
        actionUrl: `/bookings/${application.id}`,
      });
    }

    return acceptedBooking;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// START BOOKING
// ============================================================

const startBooking = async (providerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET + LOCK BOOKING
    // --------------------------------------------------------

    const bookingResult = await client.query(
      `
      SELECT
        b.id,
        b.opportunity_id,
        b.customer_id,
        b.provider_id,
        b.service_id,
        b.agreed_amount,
        b.currency,
        b.status,
        b.started_at,
        b.completed_at

      FROM bookings b

      WHERE b.id = $1
        AND b.provider_id = $2

      FOR UPDATE
      `,
      [bookingId, providerId],
    );

    if (bookingResult.rows.length === 0) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = bookingResult.rows[0];

    // --------------------------------------------------------
    // CHECK STATUS
    // --------------------------------------------------------

    if (booking.status !== "accepted") {
      const error = new Error(
        `Booking cannot be started because it is ${booking.status}`,
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // START BOOKING
    // --------------------------------------------------------

    const result = await client.query(
      `
      UPDATE bookings
      SET
        status = 'in_progress',
        started_at = NOW()

      WHERE id = $1
        AND provider_id = $2
        AND status = 'accepted'

      RETURNING
        id,
        opportunity_id,
        customer_id,
        provider_id,
        service_id,
        agreed_amount,
        currency,
        status,
        started_at,
        completed_at,
        created_at,
        updated_at
      `,
      [bookingId, providerId],
    );

    if (result.rows.length === 0) {
      const error = new Error("Unable to start booking");

      error.statusCode = 400;
      throw error;
    }

    await client.query("COMMIT");

    const startedBooking = result.rows[0];

    // --------------------------------------------------------
    // NOTIFY CUSTOMER
    // --------------------------------------------------------

    await sendNotification({
      userId: startedBooking.customer_id,
      type: "booking_started",
      title: "Job Started",
      message: "Your provider has started the job.",
      actionUrl: `/bookings/${startedBooking.id}`,
    });

    return startedBooking;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// COMPLETE BOOKING
// ============================================================

const completeBooking = async (providerId, bookingId) => {
  // ----------------------------------------------------------
  // FIND BOOKING
  // ----------------------------------------------------------

  const bookingResult = await pool.query(
    `
    SELECT
      id,
      opportunity_id,
      customer_id,
      provider_id,
      service_id,
      agreed_amount,
      currency,
      status,
      started_at,
      completed_at,
      created_at,
      updated_at
    FROM bookings
    WHERE id = $1
      AND provider_id = $2
    `,
    [bookingId, providerId],
  );

  if (bookingResult.rows.length === 0) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = bookingResult.rows[0];

  // ----------------------------------------------------------
  // CHECK STATUS
  // ----------------------------------------------------------

  if (booking.status !== "in_progress") {
    const error = new Error(
      `Booking cannot be completed because it is ${booking.status}`,
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // COMPLETE BOOKING
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    UPDATE bookings
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = $1
      AND provider_id = $2
      AND status = 'in_progress'

    RETURNING
      id,
      opportunity_id,
      customer_id,
      provider_id,
      service_id,
      agreed_amount,
      currency,
      status,
      started_at,
      completed_at,
      created_at,
      updated_at
    `,
    [bookingId, providerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Unable to complete booking");
    error.statusCode = 400;
    throw error;
  }

  const completedBooking = result.rows[0];

  // ----------------------------------------------------------
  // NOTIFY CUSTOMER
  // ----------------------------------------------------------

  await sendNotification({
    userId: completedBooking.customer_id,
    type: "booking_completed",
    title: "Job Completed",
    message:
      "Your provider has marked the job as completed. Please confirm the completion.",
    actionUrl: `/bookings/${completedBooking.id}`,
  });

  return completedBooking;
};

// ============================================================
// CUSTOMER CONFIRMS COMPLETED JOB
// ============================================================

const confirmBooking = async (customerId, bookingId) => {
  // ----------------------------------------------------------
  // CHECK BOOKING OWNERSHIP + STATUS
  // ----------------------------------------------------------

  const existingResult = await pool.query(
    `
    SELECT
      id,
      customer_id,
      provider_id,
      service_id,
      opportunity_id,
      agreed_amount,
      currency,
      status,
      customer_confirmed_at
    FROM bookings
    WHERE id = $1
      AND customer_id = $2
    `,
    [bookingId, customerId],
  );

  if (existingResult.rows.length === 0) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = existingResult.rows[0];

  // ----------------------------------------------------------
  // CHECK STATUS
  // ----------------------------------------------------------

  if (booking.status !== "completed") {
    const error = new Error(
      `Booking cannot be confirmed because it is ${booking.status}`,
    );

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PREVENT DUPLICATE CONFIRMATION
  // ----------------------------------------------------------

  if (booking.customer_confirmed_at) {
    const error = new Error("Booking has already been confirmed");

    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // CONFIRM BOOKING
  // ----------------------------------------------------------

  const result = await pool.query(
    `
    UPDATE bookings
    SET customer_confirmed_at = NOW()
    WHERE id = $1
      AND customer_id = $2
      AND status = 'completed'
      AND customer_confirmed_at IS NULL

    RETURNING
      id,
      opportunity_id,
      customer_id,
      provider_id,
      service_id,
      agreed_amount,
      currency,
      status,
      started_at,
      completed_at,
      customer_confirmed_at,
      created_at,
      updated_at
    `,
    [bookingId, customerId],
  );

  if (result.rows.length === 0) {
    const error = new Error("Unable to confirm booking");

    error.statusCode = 400;
    throw error;
  }

  const confirmedBooking = result.rows[0];

  // ----------------------------------------------------------
  // NOTIFY PROVIDER
  // ----------------------------------------------------------

  await sendNotification({
    userId: confirmedBooking.provider_id,
    type: "booking_confirmed",
    title: "Job Completion Confirmed",
    message: "The customer has confirmed that the job was completed.",
    actionUrl: `/bookings/${confirmedBooking.id}`,
  });

  return confirmedBooking;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createBooking,
  getMyBookings,
  acceptBooking,
  startBooking,
  completeBooking,
  confirmBooking,
};

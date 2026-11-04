const pool = require("../config/database");
const notificationService = require("./notificationService");
const paymentService = require("./paymentService");
const { sendOperationalEmail } = require("./emailService");

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
    console.error("Booking notification error:", error);
  }
};

const sendBookingEmail = async (options) => {
  try {
    await sendOperationalEmail(options);
  } catch (error) {
    console.error("Booking email error:", {
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Create a provider application/booking for an opportunity.
 *
 * Important:
 * - Provider must be active and verified.
 * - Opportunity must still be open and unexpired.
 * - Service must belong to provider and be active.
 * - Only one active application is allowed per provider/opportunity.
 * - Database unique index remains the final protection against concurrent requests.
 */
const createBooking = async (providerId, data) => {
  const { opportunityId, serviceId, agreedAmount } = data;

  if (!opportunityId || !serviceId || agreedAmount === undefined) {
    const error = new Error(
      "Opportunity, service and agreed amount are required"
    );
    error.statusCode = 400;
    throw error;
  }

  const amount = Number(agreedAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Agreed amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  // Verify provider account before opening the transaction.
  const providerResult = await pool.query(
    `
      SELECT u.id, pp.is_verified
      FROM users u
      INNER JOIN provider_profiles pp ON pp.user_id = u.id
      WHERE u.id = $1
        AND u.role = 'provider'
        AND u.is_active = true
      LIMIT 1
    `,
    [providerId]
  );

  if (!providerResult.rows.length) {
    const error = new Error("Provider account not found");
    error.statusCode = 404;
    throw error;
  }

  if (!providerResult.rows[0].is_verified) {
    const error = new Error(
      "Your provider account must be verified before applying"
    );
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock the opportunity.
     *
     * This prevents multiple providers from making decisions against
     * stale opportunity state while another transaction changes it.
     */
    const opportunityResult = await client.query(
      `
        SELECT
          id,
          customer_id,
          category_id,
          status,
          expires_at
        FROM opportunities
        WHERE id = $1
        FOR UPDATE
      `,
      [opportunityId]
    );

    if (!opportunityResult.rows.length) {
      const error = new Error("Opportunity not found");
      error.statusCode = 404;
      throw error;
    }

    const opportunity = opportunityResult.rows[0];

    // Expire an open opportunity if its deadline has passed.
    if (
      opportunity.status === "open" &&
      opportunity.expires_at &&
      new Date(opportunity.expires_at) <= new Date()
    ) {
      await client.query(
        `
          UPDATE opportunities
          SET status = 'expired',
              updated_at = NOW()
          WHERE id = $1
            AND status = 'open'
        `,
        [opportunityId]
      );

      const error = new Error("This opportunity has expired");
      error.statusCode = 400;
      throw error;
    }

    if (opportunity.status !== "open") {
      const error = new Error("This opportunity is no longer open");
      error.statusCode = 400;
      throw error;
    }

    // Verify the provider's service.
    const serviceResult = await client.query(
      `
        SELECT
          id,
          provider_id,
          category_id,
          is_active
        FROM services
        WHERE id = $1
        LIMIT 1
      `,
      [serviceId]
    );

    if (!serviceResult.rows.length) {
      const error = new Error("Service not found");
      error.statusCode = 404;
      throw error;
    }

    const service = serviceResult.rows[0];

    if (service.provider_id !== providerId) {
      const error = new Error("You can only use your own service");
      error.statusCode = 403;
      throw error;
    }

    if (!service.is_active) {
      const error = new Error("This service is currently inactive");
      error.statusCode = 400;
      throw error;
    }


    /*
     * Application-level duplicate check.
     *
     * Historical completed/disputed bookings are intentionally excluded.
     * The database unique partial index provides the final concurrency
     * protection for pending/accepted/in_progress applications.
     */
    const duplicateResult = await client.query(
      `
        SELECT id
        FROM bookings
        WHERE opportunity_id = $1
          AND provider_id = $2
          AND status IN ('pending', 'accepted', 'in_progress')
        LIMIT 1
      `,
      [opportunityId, providerId]
    );

    if (duplicateResult.rows.length) {
      const error = new Error(
        "You have already applied to this opportunity"
      );
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
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
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'NGN',
          'pending'
        )
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
      [
        opportunityId,
        opportunity.customer_id,
        providerId,
        serviceId,
        amount,
      ]
    );

    const booking = result.rows[0];

    await client.query("COMMIT");

    await sendNotification({
      userId: opportunity.customer_id,
      type: "booking_application",
      title: "New Booking Application",
      message: "A verified provider has applied to your opportunity.",
      actionUrl: `/bookings/${booking.id}`,
    });

    return booking;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    /*
     * PostgreSQL unique_violation.
     *
     * This can happen when two requests from the same provider reach the
     * INSERT at almost exactly the same time. The database index is the
     * final authority, so convert that technical error into the same
     * clean API response used by the normal duplicate check.
     */
    if (
      error.code === "23505" &&
      error.constraint === "uq_bookings_active_provider_application"
    ) {
      const duplicateError = new Error(
        "You have already applied to this opportunity"
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
};

const getMyBookings = async (userId, role) => {
  if (role !== "customer" && role !== "provider") {
    const error = new Error("Unsupported user role");
    error.statusCode = 403;
    throw error;
  }

  const isCustomer = role === "customer";

  const result = await pool.query(
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
        b.session_start_at,
        b.session_duration_minutes,
        b.session_details,
        b.started_at,
        b.completed_at,
        b.customer_confirmed_at,
        pay.status AS payment_status,
        ${
          isCustomer
            ? `EXISTS (
              SELECT 1
              FROM reviews r
              WHERE r.booking_id = b.id
                AND r.customer_id = b.customer_id
            ) AS has_review,`
            : ""
        }
        b.created_at,
        b.updated_at,

        o.title AS opportunity_title,
        o.description AS opportunity_description,
        o.location_text AS opportunity_location,

        s.title AS service_title,
        s.description AS service_description,

        p.first_name AS ${isCustomer ? "provider" : "customer"
    }_first_name,

        p.last_name AS ${isCustomer ? "provider" : "customer"
    }_last_name,

        p.username AS ${isCustomer ? "provider" : "customer"
    }_username,

        p.phone AS ${isCustomer ? "provider" : "customer"
    }_phone,

        p.avatar_url AS ${isCustomer ? "provider" : "customer"
    }_avatar_url

      FROM bookings b

      INNER JOIN opportunities o
        ON o.id = b.opportunity_id

      INNER JOIN services s
        ON s.id = b.service_id

      LEFT JOIN LATERAL (
        SELECT status
        FROM payments
        WHERE booking_id = b.id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) pay ON true

      INNER JOIN profiles p
        ON p.user_id = b.${isCustomer ? "provider_id" : "customer_id"
    }

      WHERE b.${isCustomer ? "customer_id" : "provider_id"
    } = $1

      ORDER BY b.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

const scheduleBookingSession = async (customerId, bookingId, data) => {
  const { sessionStartAt, sessionDurationMinutes, sessionDetails } = data;
  const start = new Date(sessionStartAt);
  const duration = Number(sessionDurationMinutes);
  const details = typeof sessionDetails === "string" ? sessionDetails.trim() : "";

  if (!sessionStartAt || Number.isNaN(start.getTime())) {
    const error = new Error("A valid session start time is required");
    error.statusCode = 400;
    throw error;
  }

  if (start <= new Date()) {
    const error = new Error("Session start time must be in the future");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(duration) || duration < 15 || duration > 1440) {
    const error = new Error("Session duration must be between 15 and 1440 minutes");
    error.statusCode = 400;
    throw error;
  }

  if (details.length > 1000) {
    const error = new Error("Session details must be 1000 characters or fewer");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      UPDATE bookings
      SET session_start_at = $1,
          session_duration_minutes = $2,
          session_details = NULLIF($3, ''),
          updated_at = NOW()
      WHERE id = $4
        AND customer_id = $5
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
        session_start_at,
        session_duration_minutes,
        session_details,
        started_at,
        completed_at,
        customer_confirmed_at,
        created_at,
        updated_at
    `,
    [start.toISOString(), duration, details, bookingId, customerId],
  );

  if (!result.rows.length) {
    const error = new Error("Only an accepted booking can have a session scheduled");
    error.statusCode = 400;
    throw error;
  }

  const booking = result.rows[0];
  await sendNotification({
    userId: booking.provider_id,
    type: "booking_session_scheduled",
    title: "Booking Session Scheduled",
    message: "The customer scheduled a session for your accepted booking.",
    actionUrl: `/bookings/${booking.id}`,
  });

  return booking;
};

const acceptBooking = async (customerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock both the booking and opportunity.
     *
     * The opportunity lock is important because selecting one application
     * must happen atomically with changing the opportunity to "taken".
     */
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
          customer.email AS customer_email,
          provider.email AS provider_email,
          provider_profile.first_name AS provider_first_name,

          o.status AS opportunity_status,
          o.expires_at,

          pp.is_verified

        FROM bookings b

        INNER JOIN opportunities o
          ON o.id = b.opportunity_id

        INNER JOIN provider_profiles pp
          ON pp.user_id = b.provider_id
        INNER JOIN users customer
          ON customer.id = b.customer_id
        INNER JOIN users provider
          ON provider.id = b.provider_id
        INNER JOIN profiles provider_profile
          ON provider_profile.user_id = b.provider_id

        WHERE b.id = $1
          AND b.customer_id = $2

        FOR UPDATE OF b, o
      `,
      [bookingId, customerId]
    );

    if (!bookingResult.rows.length) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "pending") {
      const error = new Error(
        `Booking cannot be accepted because it is ${booking.status}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!booking.is_verified) {
      const error = new Error("This provider is not verified");
      error.statusCode = 400;
      throw error;
    }

    if (booking.opportunity_status !== "open") {
      const error = new Error("This opportunity is no longer open");
      error.statusCode = 400;
      throw error;
    }

    if (
      booking.expires_at &&
      new Date(booking.expires_at) <= new Date()
    ) {
      const error = new Error("This opportunity has expired");
      error.statusCode = 400;
      throw error;
    }

    const accepted = await client.query(
      `
        UPDATE bookings

        SET status = 'accepted',
            updated_at = NOW()

        WHERE id = $1
          AND customer_id = $2
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
          customer_confirmed_at,
          created_at,
          updated_at
      `,
      [bookingId, customerId]
    );

    if (!accepted.rows.length) {
      const error = new Error("Unable to accept booking");
      error.statusCode = 400;
      throw error;
    }

    /*
     * Mark the opportunity as taken.
     */
    await client.query(
      `
        UPDATE opportunities

        SET status = 'taken',
            updated_at = NOW()

        WHERE id = $1
          AND status = 'open'
      `,
      [booking.opportunity_id]
    );

    /*
     * Find other pending applications before cancelling them so we can
     * notify those providers after the transaction commits.
     */
    const others = await client.query(
      `
        SELECT id, provider_id
        FROM bookings

        WHERE opportunity_id = $1
          AND id <> $2
          AND status = 'pending'
      `,
      [booking.opportunity_id, booking.id]
    );

    /*
     * Cancel every other pending application.
     */
    await client.query(
      `
        UPDATE bookings

        SET status = 'cancelled',
            updated_at = NOW()

        WHERE opportunity_id = $1
          AND id <> $2
          AND status = 'pending'
      `,
      [booking.opportunity_id, booking.id]
    );

    await client.query("COMMIT");

    const selected = accepted.rows[0];

    await sendNotification({
      userId: selected.provider_id,
      type: "booking_accepted",
      title: "Your Application Was Selected",
      message:
        "The customer selected your application. Please complete payment before starting the job.",
      actionUrl: `/bookings/${selected.id}`,
    });

    await sendBookingEmail({
      email: booking.provider_email,
      subject: "Your Proservora application was selected",
      eyebrow: "BOOKING UPDATE",
      title: "Your application was selected",
      greeting: `Hello ${booking.provider_first_name || "there"},`,
      intro: "The customer selected your application. Complete payment before starting the job.",
      details: [
        { label: "Amount", value: `${booking.currency} ${Number(booking.agreed_amount).toLocaleString()}` },
        { label: "Next step", value: "Wait for payment confirmation, then start the booking." },
      ],
      plainText: `Hello ${booking.provider_first_name || "there"},\n\nYour Proservora application was selected. Amount: ${booking.currency} ${Number(booking.agreed_amount).toLocaleString()}.\n\nWait for payment confirmation before starting the booking.`,
    });

    for (const other of others.rows) {
      await sendNotification({
        userId: other.provider_id,
        type: "booking_cancelled",
        title: "Application Not Selected",
        message:
          "Another provider was selected for this opportunity.",
        actionUrl: `/bookings/${other.id}`,
      });
    }

    return selected;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

const rejectBooking = async (customerId, bookingId) => {
  const result = await pool.query(
    `
      UPDATE bookings

      SET status = 'cancelled',
          updated_at = NOW()

      WHERE id = $1
        AND customer_id = $2
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
        customer_confirmed_at,
        created_at,
        updated_at
    `,
    [bookingId, customerId]
  );

  if (!result.rows.length) {
    const error = new Error("Pending application not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = result.rows[0];

  await sendNotification({
    userId: booking.provider_id,
    type: "booking_rejected",
    title: "Application Declined",
    message: "The customer declined your application.",
    actionUrl: `/bookings/${booking.id}`,
  });

  return booking;
};

const withdrawBooking = async (providerId, bookingId) => {
  const result = await pool.query(
    `
      UPDATE bookings

      SET status = 'cancelled',
          updated_at = NOW()

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
        customer_confirmed_at,
        created_at,
        updated_at
    `,
    [bookingId, providerId]
  );

  if (!result.rows.length) {
    const error = new Error("Pending application not found");
    error.statusCode = 404;
    throw error;
  }

  const booking = result.rows[0];

  await sendNotification({
    userId: booking.customer_id,
    type: "booking_withdrawn",
    title: "Provider Withdrew Application",
    message: "A provider withdrew their application.",
    actionUrl: `/bookings/${booking.id}`,
  });

  return booking;
};

const startBooking = async (providerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          b.id,
          b.customer_id,
          b.provider_id,
          b.status,
          p.status AS payment_status

        FROM bookings b

        LEFT JOIN payments p
          ON p.booking_id = b.id

        WHERE b.id = $1
          AND b.provider_id = $2

        FOR UPDATE OF b
      `,
      [bookingId, providerId]
    );

    if (!result.rows.length) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = result.rows[0];

    if (booking.status !== "accepted") {
      const error = new Error(
        `Booking cannot be started because it is ${booking.status}`
      );
      error.statusCode = 400;
      throw error;
    }

    /*
     * A provider cannot start work until the customer's payment has
     * successfully reached the "paid" state.
     */
    if (booking.payment_status !== "paid") {
      const error = new Error(
        "Customer payment must be successful before you can start the job"
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await client.query(
      `
        UPDATE bookings

        SET status = 'in_progress',
            started_at = NOW(),
            updated_at = NOW()

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
          customer_confirmed_at,
          created_at,
          updated_at
      `,
      [bookingId, providerId]
    );

    if (!updated.rows.length) {
      const error = new Error("Unable to start booking");
      error.statusCode = 400;
      throw error;
    }

    await client.query("COMMIT");

    const started = updated.rows[0];

    await sendNotification({
      userId: started.customer_id,
      type: "booking_started",
      title: "Job Started",
      message: "Your provider has started the job.",
      actionUrl: `/bookings/${started.id}`,
    });

    return started;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

const completeBooking = async (providerId, bookingId) => {
  const result = await pool.query(
    `
      UPDATE bookings

      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()

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
        customer_confirmed_at,
        created_at,
        updated_at
    `,
    [bookingId, providerId]
  );

  if (!result.rows.length) {
    const error = new Error(
      "Booking not found or cannot be completed from its current state"
    );
    error.statusCode = 400;
    throw error;
  }

  const booking = result.rows[0];

  await sendNotification({
    userId: booking.customer_id,
    type: "booking_completed",
    title: "Job Completed",
    message:
      "Your provider marked the job as completed. Please confirm completion.",
    actionUrl: `/bookings/${booking.id}`,
  });

  return booking;
};

const confirmBooking = async (customerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          id,
          customer_id,
          provider_id,
          status,
          customer_confirmed_at

        FROM bookings

        WHERE id = $1
          AND customer_id = $2

        FOR UPDATE
      `,
      [bookingId, customerId]
    );

    if (!result.rows.length) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = result.rows[0];

    if (booking.status !== "completed") {
      const error = new Error(
        `Booking cannot be confirmed because it is ${booking.status}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (booking.customer_confirmed_at) {
      const error = new Error("Booking has already been confirmed");
      error.statusCode = 400;
      throw error;
    }

    const confirmedResult = await client.query(
      `
        UPDATE bookings

        SET customer_confirmed_at = NOW(),
            updated_at = NOW()

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
      [bookingId, customerId]
    );

    if (!confirmedResult.rows.length) {
      const error = new Error("Unable to confirm booking");
      error.statusCode = 400;
      throw error;
    }

    /*
     * The booking must have a payment before the provider can receive
     * the funds.
     */
    const paymentResult = await client.query(
      `
        SELECT id
        FROM payments
        WHERE booking_id = $1
        LIMIT 1
      `,
      [bookingId]
    );

    if (!paymentResult.rows.length) {
      const error = new Error("No payment exists for this booking");
      error.statusCode = 400;
      throw error;
    }

    /*
     * Release payment inside the SAME database transaction.
     *
     * This keeps:
     * - booking confirmation
     * - payment release
     * - provider wallet credit
     * - release ledger transaction
     *
     * consistent.
     */
    await paymentService.releasePaymentInTransaction(
      customerId,
      paymentResult.rows[0].id,
      client
    );

    await client.query("COMMIT");

    const confirmed = confirmedResult.rows[0];

    await sendNotification({
      userId: confirmed.provider_id,
      type: "booking_confirmed",
      title: "Job Completion Confirmed",
      message:
        "The customer confirmed the job and your payment has been released to your available wallet balance.",
      actionUrl: `/bookings/${confirmed.id}`,
    });

    await sendNotification({
      userId: confirmed.customer_id,
      type: "payment_released",
      title: "Payment Released",
      message:
        "Your booking is complete and payment has been released to the provider.",
      actionUrl: `/payments/${bookingId}`,
    });

    return confirmed;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { }

    throw error;
  } finally {
    client.release();
  }
};

const cancelAcceptedBooking = async (customerId, bookingId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          b.id,
          b.opportunity_id,
          b.provider_id,
          b.status,
          p.status AS payment_status,
          o.status AS opportunity_status,
          o.expires_at

        FROM bookings b

        INNER JOIN opportunities o
          ON o.id = b.opportunity_id

        LEFT JOIN payments p
          ON p.booking_id = b.id

        WHERE b.id = $1
          AND b.customer_id = $2

        FOR UPDATE OF b, o
      `,
      [bookingId, customerId]
    );

    if (!result.rows.length) {
      const error = new Error("Booking not found");
      error.statusCode = 404;
      throw error;
    }

    const booking = result.rows[0];

    if (booking.status !== "accepted") {
      const error = new Error(
        "Only an accepted booking can be cancelled before work starts"
      );
      error.statusCode = 400;
      throw error;
    }

    /*
     * Any payment record means the booking has entered the payment
     * lifecycle. It must not be cancelled through this simple path.
     */
    if (booking.payment_status) {
      const error = new Error(
        "This booking already has a payment record and cannot be cancelled here. Use the payment or dispute process instead."
      );
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      `
        UPDATE bookings

        SET status = 'cancelled',
            updated_at = NOW()

        WHERE id = $1
      `,
      [bookingId]
    );

    /*
     * Re-open the opportunity if it was taken by this booking and the
     * opportunity has not already expired.
     */
    if (
      booking.opportunity_status === "taken" &&
      (
        !booking.expires_at ||
        new Date(booking.expires_at) > new Date()
      )
    ) {
      await client.query(
        `
          UPDATE opportunities

          SET status = 'open',
              updated_at = NOW()

          WHERE id = $1
            AND status = 'taken'
        `,
        [booking.opportunity_id]
      );
    }

    await client.query("COMMIT");

    await sendNotification({
      userId: booking.provider_id,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      message:
        "The customer cancelled the accepted booking before payment.",
      actionUrl: `/bookings/${booking.id}`,
    });

    return {
      id: booking.id,
      status: "cancelled",
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

module.exports = {
  createBooking,
  getMyBookings,
  acceptBooking,
  rejectBooking,
  withdrawBooking,
  cancelAcceptedBooking,
  startBooking,
  completeBooking,
  confirmBooking,
  scheduleBookingSession,
};
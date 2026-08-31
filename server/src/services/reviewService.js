const pool = require("../config/database");

// ============================================================
// CREATE REVIEW
// ============================================================

const createReview = async (customerId, data) => {
  const { bookingId, rating, review } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!bookingId || rating === undefined) {
    const error = new Error("Booking and rating are required");
    error.statusCode = 400;
    throw error;
  }

  const numericRating = Number(rating);

  if (
    !Number.isInteger(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    const error = new Error("Rating must be an integer between 1 and 5");
    error.statusCode = 400;
    throw error;
  }

  if (review !== undefined && review !== null && typeof review !== "string") {
    const error = new Error("Review must be a string");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // GET + LOCK BOOKING
    // --------------------------------------------------------

    const bookingResult = await client.query(
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
      [bookingId, customerId],
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

    if (booking.status !== "completed") {
      const error = new Error("You can only review a completed booking");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK CUSTOMER CONFIRMATION
    // --------------------------------------------------------

    if (!booking.customer_confirmed_at) {
      const error = new Error(
        "You must confirm the completed booking before leaving a review",
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------------
    // CHECK EXISTING REVIEW
    // --------------------------------------------------------

    const existingReview = await client.query(
      `
      SELECT id
      FROM reviews
      WHERE booking_id = $1
      `,
      [bookingId],
    );

    if (existingReview.rows.length > 0) {
      const error = new Error("You have already reviewed this booking");
      error.statusCode = 409;
      throw error;
    }

    // --------------------------------------------------------
    // CREATE REVIEW
    // --------------------------------------------------------

    const reviewResult = await client.query(
      `
      INSERT INTO reviews (
        booking_id,
        customer_id,
        provider_id,
        rating,
        review
      )
      VALUES ($1, $2, $3, $4, $5)

      RETURNING
        id,
        booking_id,
        customer_id,
        provider_id,
        rating,
        review,
        created_at
      `,
      [
        bookingId,
        customerId,
        booking.provider_id,
        numericRating,
        review?.trim() || null,
      ],
    );

    // --------------------------------------------------------
    // RECALCULATE PROVIDER RATING
    // --------------------------------------------------------

    const ratingResult = await client.query(
      `
      SELECT
        ROUND(AVG(rating), 2) AS rating,
        COUNT(*)::INTEGER AS total_reviews
      FROM reviews
      WHERE provider_id = $1
      `,
      [booking.provider_id],
    );

    const newRating = ratingResult.rows[0].rating;
    const totalReviews = ratingResult.rows[0].total_reviews;

    // --------------------------------------------------------
    // UPDATE PROVIDER PROFILE
    // --------------------------------------------------------

    await client.query(
      `
      UPDATE provider_profiles
      SET
        rating = $1,
        total_reviews = $2
      WHERE user_id = $3
      `,
      [newRating, totalReviews, booking.provider_id],
    );

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    return {
      review: reviewResult.rows[0],
      providerRating: {
        rating: Number(newRating),
        totalReviews,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");

    // PostgreSQL duplicate booking review protection
    if (error.code === "23505") {
      const duplicateError = new Error(
        "You have already reviewed this booking",
      );

      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createReview,
};

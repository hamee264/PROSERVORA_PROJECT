// ============================================================
// 404 NOT FOUND HANDLER
// ============================================================

const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
};

// ============================================================
// CENTRAL ERROR HANDLER
// ============================================================

const errorHandler = (error, req, res, next) => {
    // Prevent unused-parameter lint/runtime complaints while
    // keeping the standard Express error-handler signature.
    void next;

    // ----------------------------------------------------------
    // Log useful server-side information
    // ----------------------------------------------------------

    console.error("API Error:", {
        method: req.method,
        path: req.originalUrl,
        statusCode: error.statusCode || 500,
        message: error.message,
    });

    // ----------------------------------------------------------
    // Multer errors
    // ----------------------------------------------------------

    if (error && error.name === "MulterError") {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File is too large. Maximum allowed size is 5MB.",
            });
        }

        return res.status(400).json({
            success: false,
            message: "File upload failed",
        });
    }

    // ----------------------------------------------------------
    // CORS / known application errors
    // ----------------------------------------------------------

    const statusCode = Number(error.statusCode) || 500;

    // ----------------------------------------------------------
    // Never expose internal server errors to clients
    // ----------------------------------------------------------

    if (statusCode >= 500) {
        return res.status(500).json({
            success: false,
            message:
                process.env.NODE_ENV === "production"
                    ? "Internal server error"
                    : error.message || "Internal server error",
        });
    }

    // ----------------------------------------------------------
    // Expected application error
    // ----------------------------------------------------------

    return res.status(statusCode).json({
        success: false,
        message: error.message || "Request failed",
    });
};

module.exports = {
    notFoundHandler,
    errorHandler,
};
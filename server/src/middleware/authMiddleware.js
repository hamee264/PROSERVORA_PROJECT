const jwt = require("jsonwebtoken");

const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = require("../config/jwt");

// ============================================================
// AUTHENTICATE USER
// ============================================================

const authenticate = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    // No Authorization header
    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Expected format:
    // Authorization: Bearer <token>
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    // Store authenticated user information
    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ============================================================
// REQUIRE ROLE
// ============================================================

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // User must already be authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check whether user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource",
      });
    }

    next();
  };
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  authenticate,
  requireRole,
};

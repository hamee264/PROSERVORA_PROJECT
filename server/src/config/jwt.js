const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

const JWT_ISSUER = process.env.JWT_ISSUER || "proservora-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "proservora-client";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      role: user.role,
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: user.id,
    },
  );
};

module.exports = {
  generateAccessToken,
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_EXPIRES_IN,
};

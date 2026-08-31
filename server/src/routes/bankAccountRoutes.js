const express = require("express");

const { addBankAccount } = require("../controllers/bankAccountController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PROVIDER BANK ACCOUNTS
// ============================================================

router.post("/", authenticate, requireRole("provider"), addBankAccount);

module.exports = router;

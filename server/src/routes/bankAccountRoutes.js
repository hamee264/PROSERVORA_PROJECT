const express = require("express");

const {
  addBankAccount,
  getMyBankAccount,
} = require("../controllers/bankAccountController");

const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PROVIDER BANK ACCOUNTS
// ============================================================
router.get("/", authenticate, requireRole("provider"), getMyBankAccount);

router.post("/", authenticate, requireRole("provider"), addBankAccount);

module.exports = router;

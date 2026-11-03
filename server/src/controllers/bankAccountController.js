const pool = require("../config/database");

const {
  resolveBankAccount,
  createTransferRecipient,
} = require("../services/bankAccountService");

// ============================================================
// ADD PROVIDER BANK ACCOUNT
// ============================================================

const addBankAccount = async (req, res) => {
  try {
    const providerId = req.user.id;

    const { bank_code, account_number } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!bank_code || !account_number) {
      return res.status(400).json({
        success: false,
        message: "Bank code and account number are required",
      });
    }

    const cleanBankCode = String(bank_code).trim();
    const cleanAccountNumber = String(account_number).trim();

    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      return res.status(400).json({
        success: false,
        message: "Account number must be 10 digits",
      });
    }

    // ========================================================
    // CHECK EXISTING ACCOUNT
    // ========================================================

    const existingAccount = await pool.query(
      `
      SELECT
        id,
        provider_id,
        bank_code,
        bank_name,
        account_number,
        account_name,
        recipient_code,
        is_verified,
        is_default
      FROM provider_bank_accounts
      WHERE provider_id = $1
        AND account_number = $2
      LIMIT 1
      `,
      [providerId, cleanAccountNumber],
    );

    if (existingAccount.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This bank account has already been added",
        bankAccount: existingAccount.rows[0],
      });
    }

    // ========================================================
    // RESOLVE ACCOUNT THROUGH PAYSTACK
    // ========================================================

    const resolvedAccount = await resolveBankAccount(
      cleanAccountNumber,
      cleanBankCode,
    );

    if (!resolvedAccount) {
      return res.status(400).json({
        success: false,
        message: "Unable to verify bank account",
      });
    }

    const accountName = resolvedAccount.account_name;

    if (!accountName) {
      return res.status(400).json({
        success: false,
        message: "Bank account name could not be verified",
      });
    }

    // ========================================================
    // CREATE PAYSTACK RECIPIENT
    // ========================================================

    const recipient = await createTransferRecipient({
      accountNumber: cleanAccountNumber,
      bankCode: cleanBankCode,
      accountName,
      currency: "NGN",
    });

    if (!recipient?.recipient_code) {
      return res.status(500).json({
        success: false,
        message: "Paystack did not return a recipient code",
      });
    }

    // ========================================================
    // GET BANK NAME
    // ========================================================

    const bankName = recipient.details?.bank_name || "Unknown Bank";

    // ========================================================
    // SAVE BANK ACCOUNT
    // ========================================================

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ------------------------------------------------------
      // Remove default status from existing accounts
      // ------------------------------------------------------

      await client.query(
        `
        UPDATE provider_bank_accounts
        SET
          is_default = false,
          updated_at = NOW()
        WHERE provider_id = $1
        `,
        [providerId],
      );

      // ------------------------------------------------------
      // Insert new bank account
      // ------------------------------------------------------

      const result = await client.query(
        `
        INSERT INTO provider_bank_accounts (
          provider_id,
          bank_code,
          bank_name,
          account_number,
          account_name,
          recipient_code,
          is_verified,
          is_default
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          true,
          true
        )
        RETURNING
          id,
          provider_id,
          bank_code,
          bank_name,
          account_number,
          account_name,
          recipient_code,
          is_verified,
          is_default,
          created_at,
          updated_at
        `,
        [
          providerId,
          cleanBankCode,
          bankName,
          cleanAccountNumber,
          accountName,
          recipient.recipient_code,
        ],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Bank account added successfully",
        bankAccount: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Add bank account error:", error);

    return res.status(error.statusCode || 502).json({
      success: false,
      message: error.message || "Unable to verify bank account",
    });
  }
};
const getMyBankAccount = async (req, res) => {
  try {
    const providerId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id,
        provider_id,
        bank_code,
        bank_name,
        account_number,
        account_name,
        is_verified,
        is_default,
        created_at,
        updated_at
      FROM provider_bank_accounts
      WHERE provider_id = $1
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
      `,
      [providerId],
    );

    return res.status(200).json({
      success: true,
      bankAccount: result.rows[0] || null,
    });
  } catch (error) {
    console.error("Get bank account error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to retrieve bank account",
    });
  }
};
module.exports = {
  addBankAccount,
  getMyBankAccount,
};

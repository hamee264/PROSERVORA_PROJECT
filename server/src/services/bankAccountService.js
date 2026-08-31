const axios = require("axios");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystackHeaders = {
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

// ============================================================
// RESOLVE BANK ACCOUNT
// ============================================================

const resolveBankAccount = async (accountNumber, bankCode) => {
  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/bank/resolve`, {
      params: {
        account_number: accountNumber,
        bank_code: bankCode,
      },
      headers: paystackHeaders,
    });

    if (!response.data.status) {
      throw new Error(
        response.data.message || "Unable to resolve bank account",
      );
    }

    return response.data.data;
  } catch (error) {
    console.error(
      "Paystack account resolution error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Unable to verify bank account",
    );
  }
};

// ============================================================
// CREATE PAYSTACK TRANSFER RECIPIENT
// ============================================================

const createTransferRecipient = async ({
  accountNumber,
  bankCode,
  accountName,
  currency = "NGN",
}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency,
      },
      {
        headers: paystackHeaders,
      },
    );

    if (!response.data.status) {
      throw new Error(
        response.data.message || "Unable to create transfer recipient",
      );
    }

    return response.data.data;
  } catch (error) {
    console.error(
      "Paystack recipient creation error:",
      error.response?.data || error.message,
    );

    throw new Error(
      error.response?.data?.message || "Unable to create payment recipient",
    );
  }
};

module.exports = {
  resolveBankAccount,
  createTransferRecipient,
};

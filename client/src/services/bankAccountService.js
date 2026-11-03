import api from "./api";

export const getMyBankAccount = async () => {
  const response = await api.get("/provider/bank-accounts");
  return response.data;
};

export const addBankAccount = async ({ bankCode, accountNumber }) => {
  const response = await api.post("/provider/bank-accounts", {
    bank_code: bankCode,
    account_number: accountNumber,
  });
  return response.data;
};

import api from "./api";

export const getProviderWallet = async () => {
  const response = await api.get("/payouts/wallet");
  return response.data;
};

export const getProviderPayouts = async () => {
  const response = await api.get("/payouts");
  return response.data;
};

export const requestPayout = async (amount) => {
  const response = await api.post("/payouts", { amount });
  return response.data;
};

export const getPayoutPreview = async (amount) => {
  const response = await api.get("/payouts/preview", { params: { amount } });
  return response.data;
};

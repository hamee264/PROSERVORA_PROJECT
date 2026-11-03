import api from "./api";

export const getMyProviderProfile = async () => {
  const response = await api.get("/providers/me");
  return response.data;
};

export const getPublicProviderProfile = async (providerId) => {
  const response = await api.get(`/providers/public/${providerId}`);

  return response.data;
};

export const getPublicProviderServices = async (providerId) => {
  const response = await api.get(`/providers/public/${providerId}/services`);

  return response.data;
};

export const updateMyProviderProfile = async (data) => {
  const response = await api.patch("/providers/me", data);
  return response.data;
};

export const updateProviderAvailability = async (isAvailable) => {
  const response = await api.patch("/providers/me/availability", { isAvailable });
  return response.data;
};

export const getMyProviderVerification = async () => {
  const response = await api.get("/providers/me");
  return response.data;
};

export const submitProviderVerification = async (data) => {
  const response = await api.patch("/providers/me/verification", data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

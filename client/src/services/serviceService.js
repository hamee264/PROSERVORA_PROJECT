import api from "./api";

export const getServices = async (params = {}) => {
  const response = await api.get("/services", {
    params,
  });

  return response.data;
};

export const getMyServices = async () => {
  const response = await api.get("/services/me");
  return response.data;
};

export const getServiceById = async (serviceId) => {
  const response = await api.get(`/services/public/${serviceId}`);

  return response.data;
};

export const createService = async (data) => (await api.post("/services", data)).data;
export const updateService = async (id, data) => (await api.patch(`/services/${id}`, data)).data;
export const updateServiceStatus = async (id, isActive) => (await api.patch(`/services/${id}/status`, { isActive })).data;
export const deleteService = async (id) => (await api.delete(`/services/${id}`)).data;

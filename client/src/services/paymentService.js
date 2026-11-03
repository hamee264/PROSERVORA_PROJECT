import api from "./api";

export const getMyPayments = async () => {
    const response = await api.get("/payments");
    return response.data;
};

export const initializePayment = async (bookingId) => {
    const response = await api.post("/payments/initialize", { bookingId });
    return response.data;
};

export const verifyPayment = async (reference) => {
    const response = await api.post("/payments/verify", { reference });
    return response.data;
};
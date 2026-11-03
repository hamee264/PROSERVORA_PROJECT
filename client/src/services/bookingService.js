import api from "./api";

export const getMyBookings = async () => {
    const response = await api.get("/bookings/me");
    return response.data;
};

export const applyForOpportunity = async (data) => {
    const response = await api.post("/bookings", data);
    return response.data;
};

export const withdrawBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/withdraw`);
    return response.data;
};

export const startBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/start`);
    return response.data;
};

export const completeBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/complete`);
    return response.data;
};

export const acceptBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/accept`);
    return response.data;
};

export const declineBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/reject`);
    return response.data;
};

export const cancelBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/cancel`);
    return response.data;
};

export const confirmBooking = async (bookingId) => {
    const response = await api.patch(`/bookings/${bookingId}/confirm`);
    return response.data;
};

export const scheduleBookingSession = async (bookingId, data) => {
    const response = await api.patch(`/bookings/${bookingId}/session`, data);
    return response.data;
};

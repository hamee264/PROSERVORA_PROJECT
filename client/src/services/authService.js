import api from "./api";

export const registerUser = async (data) => {
    const response = await api.post("/auth/register", data);
    return response.data;
};

export const loginUser = async (data) => {
    const response = await api.post("/auth/login", data);
    return response.data;
};

export const verifyEmail = async (data) => {
    const response = await api.post("/auth/verify-email", data);
    return response.data;
};

export const resendVerification = async (data) => {
    const response = await api.post(
        "/auth/resend-verification",
        data,
    );

    return response.data;
};

export const forgotPassword = async (data) => {
    const response = await api.post(
        "/auth/forgot-password",
        data,
    );

    return response.data;
};

export const verifyResetCode = async (data) => {
    const response = await api.post(
        "/auth/verify-reset-code",
        data,
    );

    return response.data;
};

export const resetPassword = async (data) => {
    const response = await api.post(
        "/auth/reset-password",
        data,
    );

    return response.data;
};
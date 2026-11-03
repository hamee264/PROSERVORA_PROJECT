import api from "./api";

export const getMyProfile = async () => {
    const response = await api.get("/users/me");
    return response.data;
};

export const updateMyProfile = async (profileData) => {
    const response = await api.patch("/users/me", profileData);
    return response.data;
};

export const updateMyProfileImage = async (formData) => {
    const response = await api.patch("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
};
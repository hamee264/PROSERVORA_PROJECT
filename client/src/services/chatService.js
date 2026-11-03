import api from "./api";

export const startConversation = async (otherUserId) => {
    const response = await api.post("/chats", { otherUserId });
    return response.data;
};

export const getMyConversations = async () => {
    const response = await api.get("/chats");
    return response.data;
};

export const getConversationMessages = async (conversationId) => {
    const response = await api.get(`/chats/${conversationId}/messages`);
    return response.data;
};

export const sendChatMessage = async (conversationId, message) => {
    const response = await api.post(`/chats/${conversationId}/messages`, {
        message,
    });
    return response.data;
};

export const markConversationAsRead = async (conversationId) => {
    const response = await api.patch(`/chats/${conversationId}/read`);
    return response.data;
};
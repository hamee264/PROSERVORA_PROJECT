import api from "./api";

export const getMyOpportunities = async () => {
    const response = await api.get("/opportunities/me");
    return response.data;
};

export const getOpenOpportunities = async (params = {}) => {
    const response = await api.get("/opportunities", { params });
    return response.data;
};

export const getRequestedOpportunities = async () => {
    const response = await api.get("/opportunities/requested");
    return response.data;
};

export const createOpportunity = async (data) => {
    const response = await api.post("/opportunities", data);
    return response.data;
};

export const withdrawOpportunity = async (opportunityId) => {
    const response = await api.patch(
        `/opportunities/${opportunityId}/withdraw`,
    );
    return response.data;
};

export const deleteOpportunity = async (opportunityId) => {
    const response = await api.delete(`/opportunities/${opportunityId}`);
    return response.data;
};

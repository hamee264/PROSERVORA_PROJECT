import api from "./api";

export const getSearchSuggestions = async (query) => {
    const response = await api.get(
        "/services/search/suggestions",
        {
            params: {
                q: query,
            },
        },
    );

    return response.data;
};
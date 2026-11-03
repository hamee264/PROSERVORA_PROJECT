import api from "./api";

export const getMyProviderReviews = async () => {
  const response = await api.get("/reviews/me");
  return response.data;
};

export const createReview = async ({ bookingId, rating, review }) => {
  const response = await api.post("/reviews", {
    bookingId,
    rating,
    review,
  });
  return response.data;
};

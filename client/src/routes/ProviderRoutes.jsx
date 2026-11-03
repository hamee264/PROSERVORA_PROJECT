import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";

const ProviderBookings = lazy(() => import("../pages/provider/bookings/Bookings"));
const ProviderBankAccount = lazy(() => import("../pages/provider/bank-account/BankAccount"));
const ProviderDashboard = lazy(() => import("../pages/provider/dashboard/Dashboard"));
const ProviderEarnings = lazy(() => import("../pages/provider/earnings/Earnings"));
const ProviderJobs = lazy(() => import("../pages/provider/jobs/Jobs"));
const ProviderMessages = lazy(() => import("../pages/provider/messages/Messages"));
const ProviderNotifications = lazy(() => import("../pages/provider/notifications/Notifications"));
const ProviderProfile = lazy(() => import("../pages/provider/profile/Profile"));
const ProviderReviews = lazy(() => import("../pages/provider/reviews/Reviews"));
const ProviderRequestedJobs = lazy(() => import("../pages/provider/requested-jobs/RequestedJobs"));
const ProviderServices = lazy(() => import("../pages/provider/services/Services"));
const ProviderSettings = lazy(() => import("../pages/provider/settings/Settings"));
const ProviderVerification = lazy(() => import("../pages/provider/verification/Verification"));

const ProviderRoutes = (
  <>
    <Route
      path="/provider"
      element={<Navigate to="/provider/dashboard" replace />}
    />
    <Route path="/provider/dashboard" element={<ProviderDashboard />} />
    <Route path="/provider/jobs" element={<ProviderJobs />} />
    <Route path="/provider/requested-jobs" element={<ProviderRequestedJobs />} />
    <Route path="/provider/bookings" element={<ProviderBookings />} />
    <Route path="/provider/earnings" element={<ProviderEarnings />} />
    <Route path="/provider/bank-account" element={<ProviderBankAccount />} />
    <Route path="/provider/services" element={<ProviderServices />} />
    <Route path="/provider/messages" element={<ProviderMessages />} />
    <Route path="/provider/notifications" element={<ProviderNotifications />} />
    <Route path="/provider/profile" element={<ProviderProfile />} />
    <Route path="/provider/settings" element={<ProviderSettings />} />
    <Route path="/provider/reviews" element={<ProviderReviews />} />
    <Route path="/provider/verification" element={<ProviderVerification />} />
  </>
);

export default ProviderRoutes;

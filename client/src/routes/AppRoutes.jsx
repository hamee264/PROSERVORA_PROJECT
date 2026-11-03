import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout/PublicLayout.jsx";
import ClientLayout from "../layouts/ClientLayout/ClientLayout.jsx";
import ProviderLayout from "../layouts/ProviderLayout/ProviderLayout.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import AuthRoutes from "./AuthRoutes.jsx";

import ProviderRoutes from "./ProviderRoutes";

const Home = lazy(() => import("../pages/public/home/Home"));
const About = lazy(() => import("../pages/public/about/About"));
const HowItWorks = lazy(() => import("../pages/public/how-it-works/HowItWorks"));
const BecomeAProvider = lazy(() => import("../pages/public/become-a-provider/BecomeAProvider"));
const Terms = lazy(() => import("../pages/public/terms/Terms"));
const Privacy = lazy(() => import("../pages/public/privacy/Privacy"));
const NotFound = lazy(() => import("../pages/public/not-found/NotFound"));

const ClientDashboard = lazy(() => import("../pages/client/dashboard/Dashboard"));
const Discover = lazy(() => import("../pages/client/discover/Discover"));
const ServiceDetails = lazy(() => import("../pages/client/service-details/ServiceDetails"));
const ProviderProfile = lazy(() => import("../pages/client/provider-profile/ProviderProfile"));
const ClientBookings = lazy(() => import("../pages/client/bookings/Bookings"));
const ClientCategories = lazy(() => import("../pages/client/categories/Categories"));
const ClientMessages = lazy(() => import("../pages/client/messages/Messages"));
const ClientNotifications = lazy(() => import("../pages/client/notifications/Notifications"));
const ClientPayments = lazy(() => import("../pages/client/payments/Payments"));
const ClientProfile = lazy(() => import("../pages/client/profile/Profile"));
const ClientProviders = lazy(() => import("../pages/client/providers/Providers"));
const ClientRequests = lazy(() => import("../pages/client/requests/Requests"));
const ClientReviews = lazy(() => import("../pages/client/reviews/Reviews"));
const ClientServices = lazy(() => import("../pages/client/services/Services"));
const ClientSettings = lazy(() => import("../pages/client/settings/Settings"));

const RouteLoading = () => (
  <div className="app-route-loading" role="status" aria-live="polite">
    Loading page...
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* PUBLIC */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/become-a-provider" element={<BecomeAProvider />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>

        {/* AUTH */}
        {AuthRoutes}

        {/* CLIENT */}
        <Route element={<ProtectedRoute role="customer" />}>
          <Route element={<ClientLayout />}>
            <Route path="/client/dashboard" element={<ClientDashboard />} />
            <Route path="/client/discover" element={<Discover />} />
            <Route path="/client/services" element={<ClientServices />} />
            <Route path="/client/categories" element={<ClientCategories />} />
            <Route path="/client/providers" element={<ClientProviders />} />
            <Route path="/client/requests" element={<ClientRequests />} />
            <Route path="/client/bookings" element={<ClientBookings />} />
            <Route path="/client/messages" element={<ClientMessages />} />
            <Route path="/client/notifications" element={<ClientNotifications />} />
            <Route path="/client/payments" element={<ClientPayments />} />
            <Route path="/client/profile" element={<ClientProfile />} />
            <Route path="/client/settings" element={<ClientSettings />} />
            <Route path="/client/reviews" element={<ClientReviews />} />
            <Route path="/client/service-details/:serviceId" element={<ServiceDetails />} />
            <Route path="/client/provider-profile/:providerId" element={<ProviderProfile />} />
          </Route>
        </Route>

        {/* PROVIDER */}
        <Route element={<ProtectedRoute role="provider" />}>
          <Route element={<ProviderLayout />}>{ProviderRoutes}</Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;

import { Route, Routes } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout/PublicLayout.jsx";

import Home from "../pages/public/home/Home";
import About from "../pages/public/about/About";
import HowItWorks from "../pages/public/how-it-works/HowItWorks";
import BecomeAProvider from "../pages/public/become-a-provider/BecomeAProvider";
import Terms from "../pages/public/terms/Terms";
import Privacy from "../pages/public/privacy/Privacy";
import NotFound from "../pages/public/not-found/NotFound";

function PublicRoutes() {
  return (
    <PublicLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/become-a-provider" element={<BecomeAProvider />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PublicLayout>
  );
}

export default PublicRoutes;

import { Outlet } from "react-router-dom";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

function PublicLayout() {
  return (
    <div className="public-layout">
      <Navbar />

      <Outlet />

      <Footer />
    </div>
  );
}

export default PublicLayout;

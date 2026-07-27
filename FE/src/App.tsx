import { BrowserRouter as Router, Routes, Route } from "react-router";
import { Toaster } from "sonner";

import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Products from "./pages/Products/products";
import OrderPage from "./pages/OrderPage/orderpage";
import TransactionHistory from "./pages/Transactions/TransactionHistory";
import SalesReport from "./pages/Reports/SalesReport";
import DamageReport from "./pages/Reports/DamageReport";
import InventoryReport from "./pages/Reports/InventoryReport";
import Category from "./components/form/Category";
import { OrderProvider } from "./context/OrderContext";
import { ProductNotificationProvider } from "./context/ProductNotificationContext";

/**
 * Route map for the single-terminal POS.
 *
 * Every screen sits behind authentication: sales are rung up on the POS
 * Terminal by staff, so there is no public customer-facing ordering route and
 * no order queue to review.
 */
export default function App() {
  return (
    <OrderProvider>
      <ProductNotificationProvider>
        <Toaster position="top-right" expand={false} richColors style={{ zIndex: 1000000 }} />
        <Router>
          <ScrollToTop />
          <Routes>
            {/* Authenticated application shell */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index path="/dashboard" element={<Home />} />

              <Route path="/orderpage" element={<OrderPage />} />
              <Route path="/transactions" element={<TransactionHistory />} />

              <Route path="/products" element={<Products />} />
              <Route path="/category" element={<Category />} />

              <Route path="/reports/sales" element={<SalesReport />} />
              <Route path="/inventory" element={<InventoryReport />} />
              <Route path="/reports/damage" element={<DamageReport />} />

              <Route path="/profile" element={<UserProfiles />} />
            </Route>

            {/* Sign in */}
            <Route path="/" element={<SignIn />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </ProductNotificationProvider>
    </OrderProvider>
  );
}

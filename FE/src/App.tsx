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
        <Toaster
          position="top-right"
          expand={false}
          richColors
          style={{ zIndex: 1000000 }}
          toastOptions={{
            className: "rounded-2xl border shadow-lg font-medium text-xs py-3 px-4",
            classNames: {
              toast: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 transition-all duration-300",
              success: "!text-emerald-600 dark:!text-emerald-400 !bg-emerald-50/70 dark:!bg-emerald-950/20 !border-emerald-100/50 dark:!border-emerald-900/30",
              error: "!text-red-600 dark:!text-red-400 !bg-red-50/70 dark:!bg-red-950/20 !border-red-100/50 dark:!border-red-900/30",
              warning: "!text-amber-600 dark:!text-amber-400 !bg-amber-50/70 dark:!bg-amber-950/20 !border-amber-100/50 dark:!border-amber-900/30",
              info: "!text-brand-600 dark:!text-brand-400 !bg-brand-50/70 dark:!bg-brand-950/20 !border-brand-100/50 dark:!border-brand-900/30",
            }
          }}
        />
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

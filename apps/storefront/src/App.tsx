import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { CategoryPage } from "./pages/CategoryPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CartPage } from "./pages/CartPage";
import { AccountPage } from "./pages/AccountPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { SubCategoryPage } from "./pages/SubCategoryPage";
import { SearchPage } from "./pages/SearchPage";
import { RequireAdmin } from "./auth/RequireAdmin";

const AdminApp = lazy(() =>
  import("@/admin/AdminApp").then((m) => ({ default: m.AdminApp })),
);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/category/:slug" element={<CategoryPage />} />
      <Route
        path="/category/:categorySlug/:subCategorySlug"
        element={<SubCategoryPage />}
      />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/account/orders/:orderId" element={<OrderDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <Suspense fallback={<div style={{ padding: 32 }}>טוען…</div>}>
              <AdminApp />
            </Suspense>
          </RequireAdmin>
        }
      />
    </Routes>
  );
}

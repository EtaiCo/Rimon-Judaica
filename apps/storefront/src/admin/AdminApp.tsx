import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layout/AdminLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsListPage } from "./pages/ProductsListPage";
import { ProductEditPage } from "./pages/ProductEditPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { CustomersListPage } from "./pages/CustomersListPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { SecurityEventsPage } from "./pages/SecurityEventsPage";

export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsListPage />} />
        <Route path="products/new" element={<ProductEditPage />} />
        <Route path="products/:id" element={<ProductEditPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="orders" element={<OrdersListPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="activity-log" element={<ActivityLogPage />} />
        <Route path="security-events" element={<SecurityEventsPage />} />
      </Route>
    </Routes>
  );
}

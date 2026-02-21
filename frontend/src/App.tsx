import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import IngredientsPage from "./pages/IngredientsPage";
import MenuItemsPage from "./pages/MenuItemsPage";
import ReorderPage from "./pages/ReorderPage";
import SalesImportPage from "./pages/SalesImportPage";
import UsagePage from "./pages/UsagePage";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/menu-items" element={<MenuItemsPage />} />
          <Route path="/sales-import" element={<SalesImportPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/reorder" element={<ReorderPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;

import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./AdminAuth";
import { AdminLayout } from "./AdminLayout";
import { FeedbackProvider } from "./components/Feedback";
import { AdminsPage } from "./pages/AdminsPage";
import { ContentPage } from "./pages/ContentPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { UsersPage } from "./pages/UsersPage";
import "./admin.css";

/** Everything under /admin; loaded on demand so learners never download it. */
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <FeedbackProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="admins" element={<AdminsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </FeedbackProvider>
    </AdminAuthProvider>
  );
}

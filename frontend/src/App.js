import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TenantProvider } from "@/context/TenantContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import CoveragePage from "@/pages/admin/CoveragePage";
import PackagesPage from "@/pages/admin/PackagesPage";
import LeadsPage from "@/pages/admin/LeadsPage";
import BrandingPage from "@/pages/admin/BrandingPage";
import AccountPage from "@/pages/admin/AccountPage";

function Protected({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <div className="min-h-screen grid place-items-center text-slate-400">Memuat…</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <TenantProvider>
          <AuthProvider>
            <Toaster position="top-center" richColors />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/t/:subdomain" element={<Landing />} />
              <Route path="/admin/login" element={<Login />} />
              <Route path="/login" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
                <Route index element={<Dashboard />} />
                <Route path="coverage" element={<CoveragePage />} />
                <Route path="packages" element={<PackagesPage />} />
                <Route path="leads" element={<LeadsPage />} />
                <Route path="branding" element={<BrandingPage />} />
                <Route path="account" element={<AccountPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </TenantProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

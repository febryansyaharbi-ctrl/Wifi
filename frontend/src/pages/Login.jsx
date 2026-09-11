import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { BrandLogo } from "@/components/Brand";
import { formatApiError } from "@/lib/api";
import { Lock, Mail, Loader2 } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const { tenant } = useTenant();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav("/admin", { replace: true }); }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      nav("/admin", { replace: true });
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || "Login gagal");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-12 text-white" style={{ background: "hsl(var(--primary))" }}>
        <BrandLogo tenant={{ ...tenant, logo_url: null }} className="[&_span]:text-white" />
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">Panel Admin<br />WiFi Coverage</h2>
          <p className="mt-4 text-white/80 max-w-sm">Kelola jangkauan, paket, leads, dan branding tenant Anda dalam satu dashboard.</p>
        </div>
        <p className="text-white/60 text-sm">© {new Date().getFullYear()} WiFi Coverage SaaS</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><BrandLogo tenant={tenant} /></div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Masuk ke Dashboard</h1>
          <p className="text-slate-500 mt-1 mb-8 text-sm">Gunakan akun admin Anda untuk melanjutkan.</p>
          {err && <div className="mb-4 rounded-xl bg-rose-50 text-rose-600 text-sm px-4 py-3" data-testid="login-error">{err}</div>}
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label>
          <div className="relative mb-4">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 outline-none" placeholder="admin@email.com" />
          </div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
          <div className="relative mb-6">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 outline-none" placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} data-testid="login-submit-button"
                  className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
                  style={{ background: "hsl(var(--primary))" }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null} Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

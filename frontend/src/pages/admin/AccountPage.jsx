import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { UserCog, Building2, Mail, ShieldCheck } from "lucide-react";

export default function AccountPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const rows = [
    [UserCog, "Nama", user?.name],
    [Mail, "Email", user?.email],
    [ShieldCheck, "Role", user?.role],
    [Building2, "Tenant", tenant?.name],
    [Building2, "Subdomain", tenant?.subdomain],
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Akun</h1>
      <p className="text-slate-500 mt-1">Informasi akun dan tenant Anda.</p>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {rows.map(([Icon, label, value]) => (
          <div key={label} className="flex items-center gap-4 px-5 py-4">
            <span className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}><Icon size={18} /></span>
            <div><p className="text-xs text-slate-400">{label}</p><p className="font-medium text-slate-900">{value || "-"}</p></div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
        Fitur ubah password, Forgot Password, dan verifikasi WhatsApp OTP akan tersedia pada Fase 2.
      </div>
    </div>
  );
}

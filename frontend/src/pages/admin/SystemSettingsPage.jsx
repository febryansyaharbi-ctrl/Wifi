import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Settings, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/system/login-promo").then((r) => setPromo(r.data.text)).catch((e) => setMessage(formatApiError(e?.response?.data?.detail)));
  }, []);

  if (user?.role !== "SUPER_ADMIN") return <div className="text-sm text-slate-500">Akses hanya untuk Super Admin.</div>;

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      await api.put("/system/login-promo", { text: promo });
      setMessage("Teks promosi halaman login berhasil disimpan.");
    } catch (e) { setMessage(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl" data-testid="system-settings-page">
      <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-xl bg-violet-100 text-violet-700 grid place-items-center"><Settings size={21}/></span><div><h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">System Settings</h1><p className="text-slate-500 mt-1">Pengaturan global yang hanya dapat diubah Super Admin.</p></div></div>
      {message && <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{message}</div>}
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <label className="text-sm font-semibold text-slate-700">Teks ajakan Sub-Admin pada halaman login</label>
        <textarea value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={500} className="mt-2 w-full min-h-36 rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-violet-200" />
        <div className="mt-2 text-xs text-slate-400">Maksimal 500 karakter. Contoh: benefit dashboard, branding, coverage GIS, leads terisolasi, dan harga mulai.</div>
        <button onClick={save} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:"hsl(var(--primary))"}}><Save size={16}/>{busy ? "Menyimpan..." : "Simpan"}</button>
      </div>
    </div>
  );
}

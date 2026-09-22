import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Building2, Plus, Power, RefreshCw, X } from "lucide-react";

const emptyForm = {
  name: "", subdomain: "", admin_name: "", admin_email: "",
  admin_password: "", whatsapp_number: "", wifi_name: "",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/tenants"); setTenants(data); }
    catch (e) { setMessage(e?.response?.data?.detail || "Gagal memuat tenant"); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage("");
    try {
      await api.post("/tenants", form);
      setForm(emptyForm); setOpen(false);
      setMessage("Tenant dan akun SubAdmin berhasil dibuat.");
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.detail || "Gagal membuat tenant");
    } finally { setBusy(false); }
  };

  const toggle = async (tenant) => {
    if (tenant.is_default) return;
    const status = tenant.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    if (!window.confirm(status === "LOCKED" ? "Nonaktifkan tenant ini?" : "Aktifkan kembali tenant ini?")) return;
    try { await api.put("/tenants/" + tenant.id, { status }); await load(); }
    catch (e) { setMessage(e?.response?.data?.detail || "Gagal mengubah status"); }
  };

  return (
    <div data-testid="admin-tenants">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-500 mt-1">Kelola tenant dan akun SubAdmin secara terpisah.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "hsl(var(--primary))" }}>
          <Plus size={18} /> Tambah Tenant
        </button>
      </div>

      {message && <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{message}</div>}

      <div className="mt-6 grid gap-4">
        {tenants.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="h-11 w-11 shrink-0 rounded-xl grid place-items-center bg-violet-100 text-violet-600"><Building2 size={20} /></span>
                <div>
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <p className="text-sm text-slate-500">{t.wifi_name || "-"} · <b>{t.subdomain}</b></p>
                  <p className="text-xs text-slate-400 mt-1">SubAdmin: {t.sub_admin_count || 0} · WhatsApp: {t.whatsapp_number || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${t.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {t.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                </span>
                {!t.is_default && (
                  <button onClick={() => toggle(t)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Power size={16} /> {t.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!tenants.length && <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">Belum ada tenant.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 grid place-items-center">
          <form onSubmit={create} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="font-display text-xl font-bold text-slate-900">Tambah Tenant</h2><p className="text-xs text-slate-400 mt-1">Tenant baru dimulai tanpa data coverage.</p></div>
              <button type="button" onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nama Tenant" value={form.name} onChange={v => setForm({...form,name:v})} required />
              <Field label="Subdomain" placeholder="contoh: kediri" value={form.subdomain} onChange={v => setForm({...form,subdomain:v})} required />
              <Field label="Nama WiFi" value={form.wifi_name} onChange={v => setForm({...form,wifi_name:v})} />
              <Field label="WhatsApp Tenant" placeholder="08xxxxxxxxxx" value={form.whatsapp_number} onChange={v => setForm({...form,whatsapp_number:v})} required />
              <Field label="Nama SubAdmin" value={form.admin_name} onChange={v => setForm({...form,admin_name:v})} required />
              <Field label="Email SubAdmin" type="email" value={form.admin_email} onChange={v => setForm({...form,admin_email:v})} required />
              <Field label="Password SubAdmin" type="password" minLength={8} value={form.admin_password} onChange={v => setForm({...form,admin_password:v})} required />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-100 text-slate-700">Batal</button>
              <button disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:"hsl(var(--primary))"}}>
                {busy ? "Membuat..." : "Buat Tenant"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, ...props }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><input {...props} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-200" /></label>;
}

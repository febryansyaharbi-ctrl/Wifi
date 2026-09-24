import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircle2, Clock, CreditCard, RefreshCw, XCircle } from "lucide-react";

const LABELS = { PENDING_PAYMENT:"Menunggu Pembayaran", PAYMENT_REPORTED:"Menunggu Verifikasi", APPROVED:"Disetujui", REJECTED:"Ditolak", ACTIVATION_PENDING:"Menunggu Aktivasi", ACTIVATED:"Aktif" };

export default function RegistrationAdminPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/registration/admin/applications"); setItems(data || []); }
    catch (e) { setMessage(e?.response?.data?.detail || "Gagal memuat pendaftaran."); }
  };
  useEffect(() => { load(); }, []);

  const action = async (id, type) => {
    setBusy(id + type); setMessage("");
    try {
      await api.post("/registration/admin/applications/" + id + "/" + type);
      setMessage(type === "verify" ? "Pembayaran berhasil diverifikasi." : "Pendaftaran ditolak.");
      await load();
    } catch (e) { setMessage(e?.response?.data?.detail || "Aksi gagal."); }
    finally { setBusy(""); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Pendaftaran Sub-Admin</h1><p className="text-slate-500 mt-1">Verifikasi laporan pembayaran sebelum proses aktivasi akun.</p></div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw size={16}/> Refresh</button>
      </div>
      {message && <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{message}</div>}
      <div className="mt-6 space-y-4">
        {items.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">{a.name}</h2><span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-violet-50 text-violet-700">{LABELS[a.status] || a.status}</span></div>
                <p className="text-sm text-slate-500 mt-1">WhatsApp: +{a.whatsapp} · Paket: {a.plan_name}</p>
                <p className="text-sm font-bold text-slate-900 mt-1">Nominal: Rp {Number(a.amount || 0).toLocaleString("id-ID")}</p>
                <p className="text-xs text-slate-400 mt-2">ID: {a.id}</p>
                {a.payment_reported_at && <p className="text-xs text-emerald-600 mt-1">Dilaporkan: {new Date(a.payment_reported_at).toLocaleString("id-ID")}</p>}
              </div>
              {a.status === "PAYMENT_REPORTED" && <div className="flex gap-2"><button disabled={busy === a.id+"verify"} onClick={() => action(a.id,"verify")} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 disabled:opacity-50"><CheckCircle2 size={16}/> Verifikasi</button><button disabled={busy === a.id+"reject"} onClick={() => action(a.id,"reject")} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 disabled:opacity-50"><XCircle size={16}/> Tolak</button></div>}
            </div>
          </div>
        ))}
        {!items.length && <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400"><CreditCard size={32} className="mx-auto mb-3"/><p>Belum ada pendaftaran Sub-Admin.</p></div>}
      </div>
    </div>
  );
}

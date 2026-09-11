import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, MapPin, Package, CheckCircle2, XCircle, Clock, Layers } from "lucide-react";

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className={`h-10 w-10 rounded-xl grid place-items-center mb-3 ${tone}`}><Icon size={20} /></div>
      <div className="font-display text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return <div className="text-slate-400">Memuat…</div>;

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
      <p className="text-slate-500 mt-1">Ringkasan aktivitas tenant Anda.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Stat icon={Users} label="Total Leads" value={d.leads_total} tone="bg-violet-100 text-violet-600" />
        <Stat icon={CheckCircle2} label="Tercover" value={d.covered} tone="bg-emerald-100 text-emerald-600" />
        <Stat icon={XCircle} label="Belum Tercover" value={d.not_covered} tone="bg-rose-100 text-rose-600" />
        <Stat icon={Clock} label="Belum Dicek" value={d.not_checked} tone="bg-amber-100 text-amber-600" />
        <Stat icon={Package} label="Paket Internet" value={d.packages} tone="bg-blue-100 text-blue-600" />
        <Stat icon={MapPin} label="File Coverage" value={d.coverage_files} tone="bg-slate-100 text-slate-600" />
        <Stat icon={Layers} label="Area Aktif" value={d.active_geometries} tone="bg-violet-100 text-violet-600" />
        <Stat icon={MapPin} label="File Aktif" value={d.active_files} tone="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200"><h3 className="font-display font-semibold text-slate-900">Leads Terbaru</h3></div>
        {d.recent_leads?.length ? (
          <div className="divide-y divide-slate-100">
            {d.recent_leads.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <div><p className="font-medium text-slate-900">{l.name}</p><p className="text-xs text-slate-400">{l.phone}</p></div>
                <StatusBadge status={l.coverage_status} />
              </div>
            ))}
          </div>
        ) : <p className="px-5 py-6 text-slate-400 text-sm">Belum ada leads.</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    COVERED: ["Tercover", "bg-emerald-100 text-emerald-700"],
    NOT_COVERED: ["Belum Tercover", "bg-rose-100 text-rose-700"],
    NOT_CHECKED: ["Belum Dicek", "bg-amber-100 text-amber-700"],
  };
  const [t, c] = map[status] || [status, "bg-slate-100 text-slate-600"];
  return <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${c}`}>{t}</span>;
}

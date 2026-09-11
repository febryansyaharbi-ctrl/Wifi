import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { waLink } from "@/lib/format";
import { StatusBadge } from "@/pages/admin/Dashboard";
import { Search, MessageCircle, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

const STATUSES = ["ALL", "NOT_CHECKED", "COVERED", "NOT_COVERED"];
const STATUS_LABEL = { ALL: "Semua", NOT_CHECKED: "Belum Dicek", COVERED: "Tercover", NOT_COVERED: "Belum Tercover" };

export default function LeadsPage() {
  const [data, setData] = useState({ leads: [], total: 0, page: 1, limit: 20 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (status !== "ALL") params.status = status;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    try { const { data } = await api.get("/leads", { params }); setData(data); } catch {}
  }, [page, search, status, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Leads</h1>
      <p className="text-slate-500 mt-1">Daftar calon pelanggan yang mengecek coverage.</p>

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input data-testid="leads-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / nomor…"
                 className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 outline-none focus:border-[hsl(var(--primary))]" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="leads-status-filter"
                className="h-11 px-4 rounded-xl border border-slate-200 outline-none bg-white">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="leads-date-from" className="h-11 px-3 rounded-xl border border-slate-200 outline-none bg-white" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="leads-date-to" className="h-11 px-3 rounded-xl border border-slate-200 outline-none bg-white" />
      </div>

      <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {["Nama", "Nomor", "Lokasi", "Status", "Jarak", "Kota", "Dibuat", "Aksi"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100" data-testid="leads-table">
              {data.leads.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tidak ada data.</td></tr>}
              {data.leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{l.name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{l.phone}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {l.latitude != null ? (
                      <a href={`https://maps.google.com/?q=${l.latitude},${l.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-slate-900">
                        <MapPin size={14} /> {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={l.coverage_status} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{l.coverage_distance != null ? `${Math.round(l.coverage_distance)} m` : "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{l.city || "-"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-3">
                    <a href={waLink(l.phone, `Halo ${l.name}`)} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 inline-flex"><MessageCircle size={16} /></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">Total {data.total} leads</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="text-sm text-slate-600">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

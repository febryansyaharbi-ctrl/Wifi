import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Megaphone, Facebook, Music2, Link2, Unlink, RefreshCw, BarChart3, CheckCircle2 } from "lucide-react";

const PLATFORM = {
  meta: { name: "Meta Ads", icon: Facebook, description: "Hubungkan akun iklan Meta dan lihat kampanye serta performa 30 hari." },
  tiktok: { name: "TikTok Ads", icon: Music2, description: "Hubungkan akun TikTok Ads dan lihat kampanye serta laporan performa." },
};

export default function AdsPage() {
  const [connections, setConnections] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [insights, setInsights] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ads/connections");
      setConnections(data || []);
      for (const c of data || []) {
        if (c.selected_account_id) {
          await loadPlatform(c.platform);
        }
      }
    } catch (e) {
      setMessage(formatApiError(e?.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ads_connected")) setMessage(params.get("ads_connected") + " Ads berhasil terhubung.");
    if (params.get("ads_error")) setMessage("Koneksi Ads gagal atau dibatalkan. Periksa konfigurasi OAuth.");
    load();
  }, []);

  const loadPlatform = async (platform) => {
    try {
      const [c, i] = await Promise.all([
        api.get("/ads/campaigns/" + platform),
        api.get("/ads/insights/" + platform),
      ]);
      setCampaigns((s) => ({ ...s, [platform]: c.data }));
      setInsights((s) => ({ ...s, [platform]: i.data }));
    } catch (e) {
      setMessage(formatApiError(e?.response?.data?.detail));
    }
  };

  const connect = async (platform) => {
    setBusy(platform); setMessage("");
    try {
      const { data } = await api.get("/ads/connect/" + platform);
      window.location.href = data.url;
    } catch (e) {
      setMessage(formatApiError(e?.response?.data?.detail));
      setBusy("");
    }
  };

  const disconnect = async (platform) => {
    if (!window.confirm("Putuskan koneksi " + PLATFORM[platform].name + " untuk tenant ini?")) return;
    setBusy(platform);
    try {
      await api.delete("/ads/connections/" + platform);
      setConnections((items) => items.filter((x) => x.platform !== platform));
      setCampaigns((s) => ({ ...s, [platform]: null }));
      setInsights((s) => ({ ...s, [platform]: null }));
      setMessage("Koneksi berhasil diputus.");
    } catch (e) {
      setMessage(formatApiError(e?.response?.data?.detail));
    } finally { setBusy(""); }
  };

  const selectAccount = async (platform, accountId) => {
    if (!accountId) return;
    setBusy(platform);
    try {
      await api.post("/ads/connections/" + platform + "/select", { account_id: accountId });
      await loadPlatform(platform);
      setConnections((items) => items.map((x) => x.platform === platform ? { ...x, selected_account_id: accountId } : x));
    } catch (e) {
      setMessage(formatApiError(e?.response?.data?.detail));
    } finally { setBusy(""); }
  };

  return (
    <div data-testid="admin-ads">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Kampanye Iklan</h1>
          <p className="text-slate-500 mt-1">Hubungkan Meta Ads dan TikTok Ads untuk tenant ini. Data akun iklan terisolasi berdasarkan tenant.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw size={17}/> Refresh</button>
      </div>

      {message && <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{message}</div>}

      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        {Object.entries(PLATFORM).map(([key, meta]) => {
          const Icon = meta.icon;
          const conn = connections.find((x) => x.platform === key);
          const selected = conn?.selected_account_id;
          return (
            <section key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl grid place-items-center bg-slate-100 text-slate-700"><Icon size={22}/></span>
                  <div><h2 className="font-display font-bold text-slate-900">{meta.name}</h2><p className="text-xs text-slate-500 mt-1">{meta.description}</p></div>
                </div>
                {conn ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1"><CheckCircle2 size={14}/> Terhubung</span> : null}
              </div>

              {!conn ? (
                <button onClick={() => connect(key)} disabled={busy === key} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{background:"hsl(var(--primary))"}}>
                  <span className="inline-flex items-center gap-2 justify-center">{busy === key ? <RefreshCw size={17} className="animate-spin"/> : <Link2 size={17}/>} Hubungkan {meta.name}</span>
                </button>
              ) : (
                <>
                  <div className="mt-5">
                    <label className="text-xs font-semibold text-slate-600">Akun Iklan</label>
                    <select value={selected || ""} onChange={(e) => selectAccount(key, e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 bg-white">
                      <option value="">Pilih akun iklan...</option>
                      {(conn.accounts || []).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.id}{a.currency ? " · " + a.currency : ""}</option>)}
                    </select>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => loadPlatform(key)} disabled={!selected || busy === key} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><BarChart3 size={16}/> Sinkronkan</button>
                    <button onClick={() => disconnect(key)} disabled={busy === key} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2.5 text-sm font-semibold disabled:opacity-50"><Unlink size={16}/> Putus</button>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      {loading ? <div className="mt-6 text-sm text-slate-400">Memuat koneksi Ads…</div> : (
        <div className="mt-6 grid gap-5">
          {["meta", "tiktok"].map((platform) => {
            const result = campaigns[platform];
            const insight = insights[platform];
            if (!result) return null;
            const items = result.campaigns || [];
            return (
              <section key={platform} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div><h2 className="font-display font-bold text-slate-900">{PLATFORM[platform].name} · Kampanye</h2><p className="text-xs text-slate-400 mt-1">Akun: {result.account_id}</p></div>
                  <span className="text-xs font-semibold text-slate-500">{items.length} kampanye</span>
                </div>
                {insight?.data?.length > 0 && (
                  <div className="p-5 grid sm:grid-cols-3 gap-3 border-b border-slate-100">
                    {summarizeInsight(insight.data).map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-1 font-display text-xl font-bold text-slate-900">{value}</div></div>)}
                  </div>
                )}
                {!items.length ? <p className="px-5 py-7 text-sm text-slate-400">Tidak ada kampanye yang dikembalikan.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100"><th className="px-5 py-3">Kampanye</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Objektif</th><th className="px-5 py-3">ID</th></tr></thead>
                      <tbody>{items.map((item) => <tr key={item.id || item.campaign_id} className="border-b border-slate-50"><td className="px-5 py-3 font-medium text-slate-800">{item.name || item.campaign_name || "-"}</td><td className="px-5 py-3">{item.status || "-"}</td><td className="px-5 py-3">{item.objective || item.objective_type || "-"}</td><td className="px-5 py-3 text-xs text-slate-400">{item.id || item.campaign_id}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function summarizeInsight(data) {
  const first = data?.[0] || {};
  const spend = first.spend ?? first.metrics?.spend ?? 0;
  const impressions = first.impressions ?? first.metrics?.impressions ?? 0;
  const clicks = first.clicks ?? first.metrics?.clicks ?? 0;
  return [["Spend 30 hari", String(spend)], ["Impressions", String(impressions)], ["Clicks", String(clicks)]];
}

import { useEffect, useRef, useState, useCallback } from "react";
import { Crosshair, ShieldCheck, X, MapPin, Loader2, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { api, tenantParams } from "@/lib/api";
import { waLink } from "@/lib/format";
import { toast } from "sonner";

// Location state machine:
// NOT_SET -> DETECTING -> SET_BY_GPS / SET_MANUALLY -> CHECKING -> COVERED / NOT_COVERED / ERROR
const DEFAULT_CENTER = [-7.56482, 112.21828]; // Jombang (JBG) — inside seeded coverage
const DEFAULT_ZOOM = 16;

export default function CoverageMap({ lead, tenant, onClose, onProceedPackages }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const skipNextMove = useRef(false);
  const [locState, setLocState] = useState("NOT_SET");
  const [result, setResult] = useState(null); // coverage response

  const loadGeoms = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getZoom() < 12) {
      if (layerRef.current) { layerRef.current.clearLayers(); }
      return;
    }
    const b = map.getBounds();
    try {
      const { data } = await api.get("/coverage/public/geometries", {
        params: tenantParams({
          minLng: b.getWest(), minLat: b.getSouth(),
          maxLng: b.getEast(), maxLat: b.getNorth(),
        }),
      });
      if (!layerRef.current) {
        layerRef.current = window.L.geoJSON(null, {
          style: {
            color: "#6D28D9", weight: 1.5, fillColor: "#7C3AED",
            fillOpacity: 0.18, opacity: 0.7,
          },
        }).addTo(map);
      }
      layerRef.current.clearLayers();
      layerRef.current.addData(data);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true })
      .setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;

    const onMoveEnd = () => {
      loadGeoms();
      if (skipNextMove.current) { skipNextMove.current = false; return; }
      setLocState((s) => (s === "NOT_SET" || s === "DETECTING" ? "SET_MANUALLY" : s));
      setResult(null);
    };
    map.on("moveend", onMoveEnd);
    map.on("click", (e) => { map.panTo(e.latlng); });
    setTimeout(() => { map.invalidateSize(); loadGeoms(); }, 250);

    return () => { map.remove(); mapRef.current = null; };
  }, [loadGeoms]);

  const detectGps = () => {
    if (!navigator.geolocation) {
      toast.error("Lokasi otomatis tidak tersedia. Silakan tentukan lokasi pada peta.");
      return;
    }
    setLocState("DETECTING");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        skipNextMove.current = true;
        mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 16);
        setLocState("SET_BY_GPS");
        setResult(null);
        setTimeout(loadGeoms, 300);
      },
      () => {
        setLocState("NOT_SET");
        toast.error("Lokasi otomatis tidak tersedia. Silakan tentukan lokasi pada peta.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const checkCoverage = async () => {
    const c = mapRef.current.getCenter();
    setLocState("CHECKING");
    try {
      const { data } = await api.post("/coverage/check", {
        lead_id: lead?.id, latitude: c.lat, longitude: c.lng, ...tenantParams(),
      });
      setResult(data);
      setLocState(data.coverage_status === "COVERED" ? "COVERED" : "NOT_COVERED");
    } catch (e) {
      setLocState("SET_MANUALLY");
      toast.error("Terjadi kendala saat mengecek coverage. Silakan coba kembali.");
    }
  };

  const isReady = locState === "SET_BY_GPS" || locState === "SET_MANUALLY";
  const c = mapRef.current?.getCenter();

  const openWhatsApp = () => {
    const coord = c ? `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` : "";
    const text = `Halo ${tenant?.wifi_name || ""}, saya ${lead?.name}. Lokasi saya TERCOVER (${coord}). Saya ingin berlangganan internet.`;
    window.open(waLink(tenant?.whatsapp_number, text), "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900" data-testid="map-container">
      {/* header */}
      <div className="h-16 px-4 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={20} style={{ color: "hsl(var(--primary))" }} />
          <div className="min-w-0">
            <p className="font-display font-bold text-slate-900 text-sm truncate">Tentukan Lokasi Anda</p>
            <p className="text-xs text-slate-500 truncate">Geser peta untuk menentukan lokasi</p>
          </div>
        </div>
        <button onClick={onClose} data-testid="map-close-button"
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
          <X size={22} />
        </button>
      </div>

      {/* map */}
      <div className="relative flex-1">
        <div ref={mapEl} className="absolute inset-0" />

        {/* fixed center pin */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" data-testid="map-center-pin">
          <div className="center-pin -mt-8 flex flex-col items-center">
            <div className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-semibold mb-1 shadow">
              LOKASI ANDA
            </div>
            <MapPin size={44} strokeWidth={2} className="drop-shadow-lg" style={{ color: "hsl(var(--primary))" }} fill="#fff" />
          </div>
        </div>

        {/* GPS button */}
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
          <button onClick={detectGps} data-testid="map-gps-button" title="Gunakan lokasi GPS"
                  className="h-11 w-11 rounded-full bg-white shadow-md grid place-items-center text-slate-700 hover:bg-slate-50 active:scale-95 transition">
            {locState === "DETECTING" ? <Loader2 size={20} className="animate-spin" /> : <Crosshair size={20} />}
          </button>
        </div>

        {/* Floating action button — state machine */}
        {locState !== "NOT_COVERED" && (
          <div className="absolute bottom-6 inset-x-0 z-30 flex justify-center px-4">
            {locState === "NOT_SET" || locState === "DETECTING" ? (
              <button onClick={detectGps} disabled={locState === "DETECTING"}
                      data-testid="map-floating-action-button"
                      className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-base font-semibold text-white shadow-xl active:scale-95 transition"
                      style={{ background: "hsl(var(--primary))" }}>
                {locState === "DETECTING" ? <Loader2 size={20} className="animate-spin" /> : <Crosshair size={20} />}
                {locState === "DETECTING" ? "Mendeteksi Lokasi…" : "Tentukan Lokasi Saya"}
              </button>
            ) : locState === "COVERED" ? (
              <button onClick={openWhatsApp} data-testid="map-floating-action-button"
                      className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-base font-semibold text-white shadow-xl active:scale-95 transition bg-emerald-600">
                <MessageCircle size={20} /> Hubungi Kami
              </button>
            ) : (
              <button onClick={checkCoverage} disabled={locState === "CHECKING"}
                      data-testid="map-floating-action-button"
                      className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-base font-semibold text-white shadow-xl active:scale-95 transition"
                      style={{ background: "hsl(var(--primary))" }}>
                {locState === "CHECKING" ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                {locState === "CHECKING" ? "Mengecek…" : "Cek Coverage"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result modals */}
      {result && locState === "COVERED" && (
        <ResultModal
          testId="modal-covered-container" tone="emerald" icon={<CheckCircle2 size={56} />}
          title="Selamat! Lokasi Anda Tercover"
          body={`Jaringan tersedia di titik Anda${result.distance_to_coverage != null ? ` (± ${Math.round(result.distance_to_coverage)} m dari area layanan)` : ""}. Tim kami siap membantu proses pemasangan.`}
          primaryLabel="Pilih Paket & Hubungi Sales" primaryTestId="modal-covered-whatsapp-button"
          onPrimary={() => { onProceedPackages?.(); }}
          secondaryLabel="Cek Titik Lain" onSecondary={() => { setResult(null); setLocState("SET_MANUALLY"); }}
        />
      )}
      {result && locState === "NOT_COVERED" && (
        <ResultModal
          testId="modal-uncovered-container" tone="rose" icon={<XCircle size={56} />}
          title="Mohon Maaf, Lokasi Anda Belum Tercover"
          body="Titik lokasi Anda saat ini berada di luar zona layanan aktif kami. Data Anda telah kami simpan untuk prioritas perluasan jaringan."
          primaryLabel="Pindahkan Pin & Cek Lagi" primaryTestId="modal-uncovered-retry-button"
          onPrimary={() => { setResult(null); setLocState("SET_MANUALLY"); }}
          secondaryLabel="Tutup" onSecondary={onClose}
        />
      )}
    </div>
  );
}

function ResultModal({ testId, tone, icon, title, body, primaryLabel, primaryTestId, onPrimary, secondaryLabel, onSecondary }) {
  const toneColor = tone === "emerald" ? "text-emerald-600" : "text-rose-500";
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4" data-testid={testId}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 text-center animate-fade-up">
        <div className={`mx-auto mb-4 ${toneColor}`}>{icon}</div>
        <h3 className="font-display text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{body}</p>
        <div className="mt-6 space-y-2.5">
          <button onClick={onPrimary} data-testid={primaryTestId}
                  className={`w-full py-3.5 rounded-full text-white font-semibold active:scale-[0.98] transition ${tone === "emerald" ? "bg-emerald-600" : ""}`}
                  style={tone !== "emerald" ? { background: "hsl(var(--primary))" } : {}}>
            {primaryLabel}
          </button>
          <button onClick={onSecondary}
                  className="w-full py-3 rounded-full font-medium text-slate-600 hover:bg-slate-100 transition">
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

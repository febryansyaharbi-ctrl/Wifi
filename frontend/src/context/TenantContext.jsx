import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tenantParams } from "@/lib/api";
import { hexToHslString } from "@/lib/format";

const TenantContext = createContext(null);

export function applyPrimaryColor(hex) {
  const hsl = hexToHslString(hex);
  if (hsl) {
    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);
  }
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/tenant/current", { params: tenantParams() });
      setTenant(data);
      if (data?.primary_color) applyPrimaryColor(data.primary_color);
      if (data?.website_title) document.title = `${data.wifi_name || "WiFi"} — Cek Coverage`;
    } catch (e) {
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <TenantContext.Provider value={{ tenant, loading, refresh, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);

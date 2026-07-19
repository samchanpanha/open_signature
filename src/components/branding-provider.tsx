"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { brandingApi } from "@/lib/api";

interface BrandingState {
  logoUrl: string | null;
  brandColor: string | null;
  orgName: string | null;
  ready: boolean;
}

const BrandingContext = createContext<BrandingState>({
  logoUrl: null,
  brandColor: null,
  orgName: null,
  ready: false,
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BrandingState>({
    logoUrl: null,
    brandColor: null,
    orgName: null,
    ready: false,
  });

  const applyCssVariable = useCallback((color: string | null) => {
    if (typeof document === "undefined") return;
    if (color) {
      document.documentElement.style.setProperty("--brand", color);
    } else {
      document.documentElement.style.removeProperty("--brand");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await brandingApi.get();
      setState({
        logoUrl: data.logoUrl || null,
        brandColor: data.brandColor || null,
        orgName: data.orgName || null,
        ready: true,
      });
      applyCssVariable(data.brandColor || null);
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, [applyCssVariable]);

  useEffect(() => {
    load();
  }, [load]);

  return <BrandingContext.Provider value={state}>{children}</BrandingContext.Provider>;
}

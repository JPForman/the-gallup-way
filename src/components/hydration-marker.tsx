"use client";

import { useEffect } from "react";

/** Sets <html data-hydrated> once React is interactive. E2E tests wait for it. */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}

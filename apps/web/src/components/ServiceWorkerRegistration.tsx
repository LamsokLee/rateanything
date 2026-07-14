"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount (client-side only).
 * Renders nothing — purely a side-effect component.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failed — silently ignore (e.g. localhost without HTTPS)
      });
    }
  }, []);

  return null;
}

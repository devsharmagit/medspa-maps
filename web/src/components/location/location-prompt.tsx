"use client";

import { useEffect } from "react";

import { useLocation } from "@/lib/location/location-context";

/**
 * Invisible mount hook: asks the browser for the visitor's location once, on
 * pages where a location makes sense (home, search). The provider itself guards
 * against duplicate prompts and reuses a recently-stored position.
 */
export function LocationPrompt() {
  const { requestLocation } = useLocation();

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return null;
}

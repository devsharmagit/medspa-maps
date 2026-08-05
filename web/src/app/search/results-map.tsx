"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

// One pin per matching clinic — mirrors the `pins` payload from
// GET /api/search?...&pins=1 (see src/app/api/search/route.ts).
export interface MapPin {
  clinic_id: string;
  clinic_slug: string;
  clinic_name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  booking_url: string | null;
  rating: number | null;
  review_count: number;
  logo_url: string | null;
  cover_image_url: string | null;
  featured: boolean;
}

interface ResultsMapProps {
  pins: MapPin[];
  /** Search origin (near-me / typed location). When set, the map centers here. */
  origin: { lat: number; lng: number } | null;
  /** Radius in miles (for the initial zoom when an origin is present). */
  radius: number | null;
  /** Clinic whose marker should be highlighted / popped open (list → map sync). */
  activeClinicId?: string | null;
  /** Fired when a marker is clicked (map → list sync). */
  onMarkerActivate?: (clinicId: string) => void;
}

const US_CENTER: [number, number] = [39.8283, -98.5795];

function zoomForRadius(radius: number | null): number {
  if (!radius) return 10;
  if (radius <= 20) return 11;
  if (radius <= 40) return 10;
  if (radius <= 80) return 9;
  return 8;
}

function isFiniteCoord(n: number | null): n is number {
  return typeof n === "number" && Number.isFinite(n) && n !== 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand teardrop pin as an inline SVG divIcon — avoids Leaflet's broken
// default marker-image paths under bundlers, and lets us brand-colour it.
function makeIcon(featured: boolean): L.DivIcon {
  const color = featured ? "#de7f4c" : "#aa4eb3";
  const size = featured ? 34 : 30;
  const html = `
    <svg width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
      <path d="M14 0C6.3 0 0 6.1 0 13.6 0 23 14 36 14 36s14-13 14-22.4C28 6.1 21.7 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="13.5" r="5" fill="#ffffff"/>
    </svg>`;
  const h = Math.round(size * 1.3);
  return L.divIcon({
    html,
    className: "msm-pin",
    iconSize: [size, h],
    iconAnchor: [size / 2, h],
    popupAnchor: [0, -h + 4],
  });
}

function popupHtml(p: MapPin): string {
  const profile = `/practices/${p.clinic_slug}`;
  const book = p.booking_url || p.website || profile;
  const bookExternal = Boolean(p.booking_url || p.website);
  const name = escapeHtml(p.clinic_name);
  const loc = [p.city, p.state].filter(Boolean).map(String).map(escapeHtml).join(", ");
  const ratingNum = p.rating == null ? NaN : Number(p.rating);
  const reviewNum = Number(p.review_count);
  const rating = Number.isFinite(ratingNum)
    ? `<div style="margin-top:4px;font-size:12px;color:#727272">&#9733; ${ratingNum.toFixed(1)}${reviewNum ? ` (${reviewNum})` : ""}</div>`
    : "";
  const ghost =
    "flex:1;text-align:center;padding:6px 8px;border-radius:8px;font-size:12px;font-weight:600;color:#CF5B9D;text-decoration:none;border:1px solid #CF5B9D";
  // Prefer the logo; fall back to the cover/gallery photo when there's no logo.
  const thumbSrc = p.logo_url || p.cover_image_url;
  const thumbFit = p.logo_url ? "contain" : "cover";
  const logo = thumbSrc
    ? `<img src="${escapeHtml(thumbSrc)}" alt="" width="42" height="42" onerror="this.style.display='none'" style="width:42px;height:42px;flex:none;object-fit:${thumbFit};border-radius:8px;border:1px solid #ece6ec;background:#faf5fa" />`
    : "";
  return `
    <div style="min-width:200px;font-family:inherit">
      <div style="display:flex;gap:10px;align-items:flex-start">
        ${logo}
        <div style="min-width:0">
          <a href="${profile}" style="display:block;font-weight:600;font-size:14px;color:#383838;text-decoration:none;line-height:1.25">${name}</a>
          ${loc ? `<div style="margin-top:2px;font-size:12px;color:#727272">${loc}</div>` : ""}
          ${rating}
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <a href="${book}"${bookExternal ? ' target="_blank" rel="noreferrer"' : ""} style="flex:1;text-align:center;padding:6px 8px;border-radius:8px;font-size:12px;font-weight:600;color:#fff;text-decoration:none;background:linear-gradient(90deg,#DE7F4C 0%,#C341D7 100%)">Book</a>
        <a href="${profile}" style="${ghost}">View</a>
        ${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" style="${ghost}">Call</a>` : ""}
      </div>
    </div>`;
}

export default function ResultsMap({
  pins,
  origin,
  radius,
  activeClinicId,
  onMarkerActivate,
}: ResultsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  // Keep the activate callback in a ref so the markers effect doesn't depend on it.
  const activateRef = useRef(onMarkerActivate);
  activateRef.current = onMarkerActivate;

  // ── Init map once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: US_CENTER,
      zoom: 4,
      scrollWheelZoom: true,
      attributionControl: true,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);
    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    groupRef.current = group;

    // The map often mounts inside a container that just became visible (view
    // toggle) — recompute size so tiles fill it.
    const t = setTimeout(() => map.invalidateSize(), 0);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      markerByIdRef.current.clear();
    };
  }, []);

  // ── (Re)build markers + recenter when the data changes ──
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markerByIdRef.current.clear();

    const coords: [number, number][] = [];
    for (const p of pins) {
      if (!isFiniteCoord(p.lat) || !isFiniteCoord(p.lng)) continue;
      const marker = L.marker([p.lat, p.lng], { icon: makeIcon(p.featured) });
      marker.bindPopup(popupHtml(p), { maxWidth: 260, closeButton: true });
      marker.on("click", () => activateRef.current?.(p.clinic_id));
      marker.addTo(group);
      markerByIdRef.current.set(p.clinic_id, marker);
      coords.push([p.lat, p.lng]);
    }

    map.invalidateSize();
    if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      map.setView([origin.lat, origin.lng], zoomForRadius(radius));
    } else if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
    } else {
      map.setView(US_CENTER, 4);
    }
    // Depend on primitive origin coords (not the object identity) so unrelated
    // parent re-renders don't reset the map view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, origin?.lat, origin?.lng, radius]);

  // ── List → map sync: open the active clinic's popup ──
  useEffect(() => {
    if (!activeClinicId) return;
    const map = mapRef.current;
    const marker = markerByIdRef.current.get(activeClinicId);
    if (map && marker) {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  }, [activeClinicId]);

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 320 }} />;
}

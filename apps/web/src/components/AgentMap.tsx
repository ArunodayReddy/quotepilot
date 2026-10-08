/**
 * AgentMap — Leaflet map of agent pins. No API key required (OSM tiles).
 *
 * Accessibility: the map is a visual enhancement. The agent list rendered
 * below the map is the accessible equivalent — every pin has a list card.
 * The map region carries an aria-label; zoom controls are keyboard reachable.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentEntry } from "../lib/types";

interface AgentMapProps {
  agents: AgentEntry[];
  onPinClick?: (agentId: string) => void;
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "qp-pin-wrap",
    html: `<span class="qp-pin" aria-hidden="true"><b>${index + 1}</b></span>`,
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -40],
  });
}

function popupHtml(a: AgentEntry): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const phoneDigits = a.phone.replace(/\D/g, "");
  const phoneLine =
    /^\d+$/.test(phoneDigits) && phoneDigits.length >= 7
      ? `<a href="tel:${phoneDigits}">${esc(a.phone)}</a>`
      : esc(a.phone);
  return (
    `<div class="qp-popup"><strong>${esc(a.name)}</strong>` +
    `<div>${esc(a.address)}, ${esc(a.city)} ${esc(a.zip)}</div>` +
    `<div>${phoneLine}</div>` +
    `<div class="qp-popup-hours">Mon–Fri: ${esc(a.hours.weekdays)}<br>Sat: ${esc(a.hours.saturday)} · Sun: ${esc(a.hours.sunday)}</div>` +
    (a.distance_mi != null ? `<div class="qp-popup-dist">${a.distance_mi.toFixed(1)} mi away</div>` : "") +
    `</div>`
  );
}

export function AgentMap({ agents, onPinClick }: AgentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      zoomAnimation: !reduced,
      fadeAnimation: !reduced,
    }).setView([42.36, -71.1], 11);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Refresh pins when agents change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const withCoords = agents.filter(
      (a) => typeof a.lat === "number" && typeof a.lng === "number" && Number.isFinite(a.lat) && Number.isFinite(a.lng),
    );
    withCoords.forEach((a, i) => {
      const marker = L.marker([a.lat, a.lng], {
        icon: pinIcon(i),
        title: a.name,
        alt: `${a.name}, ${a.city}`,
        keyboard: true,
      });
      marker.bindPopup(popupHtml(a), { closeButton: true });
      marker.on("click", () => onPinClickRef.current?.(a.id));
      layer.addLayer(marker);
    });
    if (withCoords.length > 0) {
      const bounds = L.latLngBounds(withCoords.map((a) => [a.lat, a.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { animate: false });
    }
  }, [agents]);

  return (
    <div
      ref={containerRef}
      className="agent-map"
      role="region"
      aria-label={`Map of ${agents.length} insurance agent locations. The list below the map contains the same agents in text form.`}
    />
  );
}

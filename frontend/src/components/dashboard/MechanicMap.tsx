import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates, NearbyMechanic } from '../../lib/discovery';

interface Props {
  origin: Coordinates | null;
  mechanics: NearbyMechanic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Emoji pins keep us free of Leaflet's bundled image assets and any icon CDN. */
const pin = (emoji: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:34px;height:34px;border-radius:999px;font-size:17px;
      background:${active ? '#10b981' : 'rgba(24,24,27,0.95)'};
      border:2px solid ${active ? '#6ee7b7' : 'rgba(255,255,255,0.25)'};
      box-shadow:0 4px 14px rgba(0,0,0,0.55);
      transform:${active ? 'scale(1.12)' : 'none'};transition:transform .15s;
    ">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

/**
 * Leaflet map with an OpenStreetMap basemap (RAD section 4). Wrapped directly
 * rather than via react-leaflet, whose current major requires React 19.
 */
export default function MechanicMap({ origin, mechanics, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const originMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629], // India centroid until a real position arrives
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;

    // The container is laid out by flex after the map is created, so Leaflet's
    // cached size is stale and only part of the viewport gets tiles. Recompute
    // once on mount and again whenever the container resizes (including the
    // desktop/mobile layout switch).
    const invalidate = () => map.invalidateSize();
    requestAnimationFrame(invalidate);
    const observer = new ResizeObserver(invalidate);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Customer position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !origin) return;
    const latlng: L.LatLngExpression = [origin.latitude, origin.longitude];
    if (originMarkerRef.current) {
      originMarkerRef.current.setLatLng(latlng);
    } else {
      originMarkerRef.current = L.marker(latlng, { icon: pin('📍', false) })
        .addTo(map)
        .bindTooltip('You are here');
    }
    if (map.getZoom() < 12) map.setView(latlng, 13);
  }, [origin]);

  // Mechanic markers, rebuilt whenever results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    mechanics.forEach((mechanic) => {
      const marker = L.marker([mechanic.latitude, mechanic.longitude], {
        icon: pin('🔧', mechanic.id === selectedId),
      })
        .addTo(map)
        .bindTooltip(`${mechanic.garage_name} · ${mechanic.distance_km} km`);
      marker.on('click', () => onSelectRef.current(mechanic.id));
      markersRef.current.set(mechanic.id, marker);
    });

    // Frame everything that matters once results arrive.
    const points: L.LatLngExpression[] = mechanics.map((m) => [m.latitude, m.longitude]);
    if (origin) points.push([origin.latitude, origin.longitude]);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
    }
    // `selectedId` is handled by the highlight effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanics, origin]);

  // Highlight without rebuilding markers, and pan the selection into view.
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(pin('🔧', id === selectedId));
      if (id === selectedId) {
        marker.setZIndexOffset(1000);
        map?.panTo(marker.getLatLng(), { animate: true });
      } else {
        marker.setZIndexOffset(0);
      }
    });
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      data-testid="mechanic-map"
      role="application"
      aria-label="Map of nearby mechanics"
      className="h-full w-full rounded-[28px] overflow-hidden border border-white/10 bg-[#0A0A0B] z-0"
    />
  );
}

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

/* ── Design tokens ── */
const BRAND = '#00966B';
const BLUE = '#0063F7';

/** Customer location — blue circle with white ring, matching reference */
const customerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative; width:24px; height:24px;">
    <div style="position:absolute; inset:-8px; background:${BLUE}18; border-radius:50%; animation:pulse 2s ease-in-out infinite;"></div>
    <div style="width:24px; height:24px; background:${BLUE}; border:4px solid white; border-radius:50%; box-shadow:0 2px 8px rgba(0,99,247,0.35); position:relative; z-index:2;"></div>
  </div>
  <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}</style>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/** Mechanic marker — emerald circle with white wrench SVG */
const mechanicIcon = (active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:${active ? '44px' : '36px'}; height:${active ? '44px' : '36px'};
      background:${active ? BRAND : '#ffffff'};
      border:${active ? '3px solid white' : '2px solid #e5e7eb'};
      border-radius:50%;
      box-shadow:${active
        ? `0 0 0 5px ${BRAND}25, 0 4px 16px ${BRAND}40`
        : '0 2px 8px rgba(0,0,0,0.12)'};
      transition:all 0.25s cubic-bezier(0.4,0,0.2,1);
      cursor:pointer;
    ">
      <svg width="${active ? '20' : '17'}" height="${active ? '20' : '17'}" viewBox="0 0 24 24" fill="none" stroke="${active ? '#ffffff' : BRAND}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    </div>`,
    iconSize: active ? [44, 44] : [36, 36],
    iconAnchor: active ? [22, 22] : [18, 18],
  });

/** Distance badge — white pill next to marker */
const distanceBadge = (km: number) =>
  L.divIcon({
    className: '',
    html: `<div style="
      white-space:nowrap; padding:3px 8px; font-size:11px; font-weight:600;
      font-family:Inter,system-ui,sans-serif; color:#111827;
      background:white; border-radius:999px;
      box-shadow:0 1px 6px rgba(0,0,0,0.12);
      pointer-events:none; line-height:1.3;
    ">${km} km</div>`,
    iconSize: [60, 22],
    iconAnchor: [-8, 11],
  });

/**
 * Leaflet map with a CartoDB light basemap.
 */
export default function MechanicMap({ origin, mechanics, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const badgesRef = useRef<Map<string, L.Marker>>(new Map());
  const originMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [23.0225, 72.5714],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
    mapRef.current = map;

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
      originMarkerRef.current = L.marker(latlng, { icon: customerIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip('You are here');
    }
    map.setView(latlng, 14, { animate: true });
  }, [origin]);

  // Mechanic markers + distance badges, rebuilt whenever results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    badgesRef.current.forEach((m) => m.remove());
    badgesRef.current.clear();

    mechanics.forEach((mechanic) => {
      const latlng: L.LatLngExpression = [mechanic.latitude, mechanic.longitude];
      const marker = L.marker(latlng, {
        icon: mechanicIcon(mechanic.id === selectedId),
      })
        .addTo(map)
        .bindTooltip(`${mechanic.garage_name} · ${mechanic.distance_km} km`);
      marker.on('click', () => onSelectRef.current(mechanic.id));
      markersRef.current.set(mechanic.id, marker);

      // Distance badge
      const badge = L.marker(latlng, {
        icon: distanceBadge(mechanic.distance_km),
        interactive: false,
      }).addTo(map);
      badgesRef.current.set(mechanic.id, badge);
    });

    // Frame everything once results arrive.
    const points: L.LatLngExpression[] = mechanics.map((m) => [m.latitude, m.longitude]);
    if (origin) points.push([origin.latitude, origin.longitude]);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { 
        paddingTopLeft: [450, 90], // Offset for left panel and top nav
        paddingBottomRight: [50, 50],
        maxZoom: 14 
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanics, origin]);

  // Highlight without rebuilding markers, and pan the selection into view.
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(mechanicIcon(id === selectedId));
      if (id === selectedId) {
        marker.setZIndexOffset(1000);
        map?.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
      } else {
        marker.setZIndexOffset(0);
      }
    });
  }, [selectedId]);

  const handleZoomIn = () => { mapRef.current?.zoomIn(); };
  const handleZoomOut = () => { mapRef.current?.zoomOut(); };
  const handleLocate = () => {
    if (mapRef.current && origin) {
      mapRef.current.setView([origin.latitude, origin.longitude], 14, { animate: true });
    }
  };

  /* Glass control styles */
  const ctrlBase = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  } as React.CSSProperties;

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <div
        ref={containerRef}
        data-testid="mechanic-map"
        role="application"
        aria-label="Map of nearby mechanics"
        className="absolute inset-0 w-full h-full"
        style={{ background: '#f0f4f8' }}
      />
      {/* Custom Glass Map Controls — right side, vertically centered */}
      <div className="absolute right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {/* Locate */}
        <button onClick={handleLocate} title="Recenter"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition-colors"
          style={ctrlBase}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
        </button>
        {/* Zoom */}
        <div className="flex flex-col rounded-xl overflow-hidden" style={ctrlBase}>
          <button onClick={handleZoomIn} title="Zoom In"
            className="w-10 h-10 flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-black/[0.03] transition-colors border-b border-zinc-200/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button onClick={handleZoomOut} title="Zoom Out"
            className="w-10 h-10 flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-black/[0.03] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
          </button>
        </div>
        {/* Layers */}
        <button title="Layers"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition-colors"
          style={ctrlBase}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

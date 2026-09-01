import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Booking } from '../../lib/booking';

interface Props {
  mechanicLocation: { latitude: number; longitude: number } | null;
  bookings: Booking[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const BRAND = '#00966B';
const BLUE = '#0063F7';

/** Mechanic's own location marker (pulse/glow) */
const selfIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative; width:24px; height:24px;">
    <div style="position:absolute; inset:-8px; background:${BRAND}18; border-radius:50%; animation:pulse 2s ease-in-out infinite;"></div>
    <div style="width:24px; height:24px; background:${BRAND}; border:4px solid white; border-radius:50%; box-shadow:0 2px 8px rgba(0,150,107,0.35); position:relative; z-index:2;"></div>
  </div>
  <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}</style>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/** Customer booking marker (wrench icon) */
const bookingIcon = (status: Booking['status'], active: boolean) => {
  const color = status === 'PENDING' ? BRAND : BLUE;
  return L.divIcon({
    className: '',
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:${active ? '44px' : '36px'}; height:${active ? '44px' : '36px'};
      background:${active ? color : '#ffffff'};
      border:${active ? '3px solid white' : '2px solid #e5e7eb'};
      border-radius:50%;
      box-shadow:${active
        ? `0 0 0 5px ${color}25, 0 4px 16px ${color}40`
        : '0 2px 8px rgba(0,0,0,0.12)'};
      transition:all 0.25s cubic-bezier(0.4,0,0.2,1);
      cursor:pointer;
    ">
      <svg width="${active ? '20' : '17'}" height="${active ? '20' : '17'}" viewBox="0 0 24 24" fill="none" stroke="${active ? '#ffffff' : color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    </div>`,
    iconSize: active ? [44, 44] : [36, 36],
    iconAnchor: active ? [22, 22] : [18, 18],
  });
};

export default function DispatchMap({ mechanicLocation, bookings, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selfMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [23.0225, 72.5714],
      zoom: 13,
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

  // Mechanic position
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mechanicLocation) return;
    const latlng: L.LatLngExpression = [mechanicLocation.latitude, mechanicLocation.longitude];
    
    if (selfMarkerRef.current) {
      selfMarkerRef.current.setLatLng(latlng);
    } else {
      selfMarkerRef.current = L.marker(latlng, { icon: selfIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindTooltip('Your Location');
    }

    if (!selectedId && bookings.length === 0) {
      map.setView(latlng, 13, { animate: true });
    }
  }, [mechanicLocation, selectedId, bookings.length]);

  // Booking markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // We only show pending, accepted, or in_progress bookings on the map.
    const activeBookings = bookings.filter(b => ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(b.status));

    // Remove old
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    activeBookings.forEach((booking) => {
      if (!booking.service_latitude || !booking.service_longitude) return;
      const latlng: L.LatLngExpression = [booking.service_latitude, booking.service_longitude];
      
      const marker = L.marker(latlng, {
        icon: bookingIcon(booking.status, booking.id === selectedId),
      }).addTo(map).bindTooltip(`${booking.customer.name} - ${booking.problem_description}`);
      
      marker.on('click', () => onSelectRef.current(booking.id));
      markersRef.current.set(booking.id, marker);
    });

    // Zoom to selected booking
    if (selectedId) {
      const selected = activeBookings.find(b => b.id === selectedId);
      if (selected && selected.service_latitude && selected.service_longitude) {
        map.setView([selected.service_latitude, selected.service_longitude], 15, { animate: true });
      }
    } else if (activeBookings.length > 0) {
      // Fit all active bookings if no selection
      const bounds = L.latLngBounds(activeBookings.filter(b => b.service_latitude).map(b => [b.service_latitude, b.service_longitude] as L.LatLngTuple));
      if (mechanicLocation) bounds.extend([mechanicLocation.latitude, mechanicLocation.longitude]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

  }, [bookings, selectedId, mechanicLocation]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      {/* Zoom Controls Overlay */}
      <div className="absolute right-6 bottom-32 z-[400] flex flex-col gap-2">
        <button
          onClick={() => {
            if (mechanicLocation && mapRef.current) {
              mapRef.current.setView([mechanicLocation.latitude, mechanicLocation.longitude], 15, { animate: true });
            }
          }}
          className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur border border-white/60 shadow-sm flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <div className="flex flex-col rounded-xl bg-white/90 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <button onClick={() => mapRef.current?.zoomIn()} className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:bg-black/5 hover:text-zinc-900 transition-colors border-b border-zinc-200/50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button onClick={() => mapRef.current?.zoomOut()} className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:bg-black/5 hover:text-zinc-900 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProvinceStatusData } from '@/hooks/useDashboardStats';

// NOTE: requires `leaflet` and `react-leaflet`-free usage (raw leaflet only
// here). Install with: npm install leaflet

const BRAND_TEAL = '#00BAAD';

const STATUS_COLORS = {
  resolved: '#1E9E4A', // green — successful
  pending: '#E2A030',  // amber — pending, still within SLA
  failed: '#DC3545',   // red — overdue past the 30-day SLA
} as const;

type StatusKey = keyof typeof STATUS_COLORS;
const STATUS_ORDER: StatusKey[] = ['resolved', 'pending', 'failed'];
const STATUS_LABELS: Record<StatusKey, string> = {
  resolved: 'Successful',
  pending: 'Pending',
  failed: 'Failed / overdue',
};

// Real-world coordinates (provincial capital / population centroid) — the
// tiles underneath are actual OpenStreetMap-derived roads and terrain, so
// pins need to sit at real lat/lngs, not stylised positions.
const PROVINCE_LOCATIONS: { id: string; name: string; lat: number; lng: number }[] = [
  { id: 'limpopo', name: 'Limpopo', lat: -23.9045, lng: 29.4689 },
  { id: 'north-west', name: 'North West', lat: -25.8560, lng: 25.6403 },
  { id: 'gauteng', name: 'Gauteng', lat: -26.2041, lng: 28.0473 },
  { id: 'mpumalanga', name: 'Mpumalanga', lat: -25.4753, lng: 30.9694 },
  { id: 'kwazulu-natal', name: 'KwaZulu-Natal', lat: -29.6006, lng: 30.3794 },
  { id: 'free-state', name: 'Free State', lat: -29.0852, lng: 26.1596 },
  { id: 'eastern-cape', name: 'Eastern Cape', lat: -32.0000, lng: 26.5000 },
  { id: 'western-cape', name: 'Western Cape', lat: -33.9249, lng: 18.4241 },
  { id: 'northern-cape', name: 'Northern Cape', lat: -28.7282, lng: 24.7499 },
];

// Small lat/lng offsets so a province's three status pins sit side by side
// instead of stacking exactly on top of one another.
const PIN_OFFSETS: [number, number][] = [
  [-0.4, -0.3],  // resolved
  [0.4, -0.3],   // pending
  [0, 0.4],      // failed
];

function pinSize(count: number): number {
  return Math.max(24, Math.min(42, 24 + Math.sqrt(count) * 2.6));
}

/** A rounded map pin with a small document glyph inside — a real case file, not a plain dot. */
function docPinIcon(color: string, count: number): L.DivIcon {
  const w = pinSize(count);
  const h = w * 1.28;
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:${w}px; height:${h}px; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
        <svg width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}"/>
          <circle cx="14" cy="13" r="9" fill="white"/>
          <path d="M10.5 8.7h5l2 2v9.1a0.8 0.8 0 0 1-0.8 0.8h-6.4a0.8 0.8 0 0 1-0.8-0.8V9.5a0.8 0.8 0 0 1 0.8-0.8z" fill="none" stroke="${color}" stroke-width="1.1"/>
          <path d="M15.5 8.7v2h2" fill="none" stroke="${color}" stroke-width="1.1"/>
          <line x1="11.6" y1="14.2" x2="16.4" y2="14.2" stroke="${color}" stroke-width="1"/>
          <line x1="11.6" y1="16.3" x2="16.4" y2="16.3" stroke="${color}" stroke-width="1"/>
          <line x1="11.6" y1="18.4" x2="14.8" y2="18.4" stroke="${color}" stroke-width="1"/>
        </svg>
        <div style="position:absolute; top:-3px; right:-3px; min-width:15px; height:15px; padding:0 3px; border-radius:8px; background:${color}; border:1.5px solid white; color:white; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; line-height:1;">${count}</div>
      </div>
    `,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  });
}

interface Props {
  data: ProvinceStatusData[] | undefined;
  loading?: boolean;
}

const ProvinceLiveMap: React.FC<Props> = ({ data, loading }) => {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byName = new Map<string, ProvinceStatusData>();
  (data ?? []).forEach((d) => byName.set(d.name, d));

  // Init the map once.
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center: [-29.0, 24.5],
      zoom: 5,
      minZoom: 5,
      maxZoom: 17,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    // CartoDB Positron — soft, real streets/terrain without visual noise.
    // Free, no API key. For heavier production traffic, swap for a paid
    // tile provider (MapTiler / Mapbox) with your own key instead.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)place markers whenever the data changes — one pin per non-zero
  // status per province, not a single dominant-color dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    PROVINCE_LOCATIONS.forEach((loc) => {
      const stats = byName.get(loc.name);
      if (!stats) return;

      STATUS_ORDER.forEach((status, i) => {
        const count = stats[status];
        if (count <= 0) return;
        const [dLat, dLng] = PIN_OFFSETS[i];
        const marker = L.marker([loc.lat + dLat, loc.lng + dLng], {
          icon: docPinIcon(STATUS_COLORS[status], count),
        })
          .addTo(map)
          .bindTooltip(`${loc.name} — ${STATUS_LABELS[status]}: ${count}`, { direction: 'top' })
          .on('click', () => setSelectedId(loc.id));

        markersRef.current.push(marker);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const selectedLoc = PROVINCE_LOCATIONS.find((p) => p.id === selectedId) ?? null;
  const selected = selectedLoc ? byName.get(selectedLoc.name) : undefined;

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-lg md:h-[640px]">
      <div ref={mapElRef} className="h-full w-full" />

      {/* Floating KPI strip — glass pills over the map, not a card grid below it */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        {STATUS_ORDER.map((key) => {
          const total = (data ?? []).reduce((s, p) => s + p[key], 0);
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-black shadow-sm backdrop-blur-sm"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
              {STATUS_LABELS[key]}
              <span className="font-bold">{loading ? '–' : total}</span>
            </div>
          );
        })}
      </div>

      {/* Province detail — slides in over the map like a floating card, not a boxed panel beside it */}
      {selectedLoc && (
        <div className="absolute bottom-3 left-3 right-3 max-w-xs rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm md:left-auto md:right-3">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: BRAND_TEAL }}>
                Province
              </div>
              <p className="text-base font-bold text-black">{selectedLoc.name}</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-slate-400 hover:text-black"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {!selected || selected.total === 0 ? (
            <p className="text-sm text-slate-500">No case files recorded here yet.</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-black">{selected.total}</p>
              <p className="mb-3 text-xs text-slate-500">total case files</p>
              <div className="space-y-1.5 text-xs">
                {STATUS_ORDER.map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                      {STATUS_LABELS[key]}
                    </span>
                    <span className="font-semibold text-black">{selected[key]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProvinceLiveMap;

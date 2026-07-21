import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock } from 'lucide-react';
import type { ProvinceStatusData } from '@/hooks/useDashboardStats';

// NOTE: requires `leaflet` and `react-leaflet`-free usage (raw leaflet only
// here). Install with: npm install leaflet

const BRAND_TEAL = '#00BAAD';
// Full wordmark lockup, transparent background, high-resolution — the one
// legible piece of branding meant to sit large on top of the map. Drop the
// file at this exact path/name in the repo (public/lovable-uploads/) and it
// picks it up automatically — no code change needed.
const logoWordmarkSrc = '/lovable-uploads/logo-transparent.png';

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

// South Africa mainland envelope (Prince Edward Islands excluded on purpose)
// — the map is locked to this box: it never pans or zooms past the
// country's borders, and never zooms in/out of it either.
const SA_BOUNDS = L.latLngBounds(
  L.latLng(-35.3, 16.3),  // south-west
  L.latLng(-21.8, 33.2),  // north-east
);

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
      <div style="position:relative; width:${w}px; height:${h}px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
        <svg width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="0.5"/>
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
  /** Lets the parent page control height/edge-to-edge sizing for the full-screen layout. */
  className?: string;
}

/**
 * Live time, styled the same way as the pill on the Appointment Engine page
 * (pulsing teal dot + clock icon + monospace time) — one consistent "this is
 * live" treatment across the portal instead of two different clock designs.
 * Ticks off a single interval; the date line above it rides the same clock
 * so both stay in sync and nothing drifts out at midnight.
 */
const MapLiveStatus: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const date = now.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{date}</p>
      <div className="flex items-center gap-2 border border-black/10 bg-black/[0.03] px-3 py-1.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: BRAND_TEAL }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL }} />
        </span>
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-mono text-sm font-semibold tabular-nums text-black sm:text-base">{time}</span>
      </div>
    </div>
  );
};

/**
 * The brand card — a compact floating panel in the map's top-left corner,
 * not a wash across half the map: the map itself is the background, this is
 * just identity sitting on top of it. Bigger logo, then date, then the live
 * clock beneath it, on a frosted white card that stays legible over the
 * light basemap without hiding the province pins behind it.
 */
const MapBrandPanel: React.FC = () => (
  <div className="pointer-events-none absolute left-3 top-3 z-[2] max-w-[calc(100%-1.5rem)] sm:left-4 sm:top-4">
    <div className="pointer-events-auto inline-flex max-w-full flex-col items-start gap-2.5 rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg ring-1 ring-black/[0.02] backdrop-blur-md sm:gap-3 sm:p-4">
      <img
        src={logoWordmarkSrc}
        alt="Kutlwano & Associate"
        className="h-14 w-auto max-w-[210px] object-contain sm:h-16 sm:max-w-[260px] lg:h-20 lg:max-w-[300px]"
      />
      <MapLiveStatus />
    </div>
  </div>
);

const ProvinceLiveMap: React.FC<Props> = ({ data, loading, className }) => {
  const mapElRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byName = new Map<string, ProvinceStatusData>();
  (data ?? []).forEach((d) => byName.set(d.name, d));

  // Init the map once, locked to South Africa: fit the country into
  // whatever space is available, then pin min/max zoom to that exact level
  // so nobody can zoom in or out, and clamp panning to the same bounds.
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      zoomSnap: 0.05,
      zoomControl: false,
      // Attribution control intentionally off per client request — note for
      // future maintainers: CARTO/OpenStreetMap's free tiles normally
      // require on-map attribution under their usage terms, so if this ever
      // needs to move to heavier/paid traffic, re-check that provider's
      // current policy before staying attribution-free.
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      keyboard: false,
      inertia: false,
    });

    // CartoDB Positron — clean, light basemap with real streets/terrain so
    // the map itself reads as an airy background instead of a dark slab.
    // Free, no API key. For heavier production traffic, swap for a paid
    // tile provider (MapTiler / Mapbox) with your own key instead.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const lockToSouthAfrica = () => {
      map.invalidateSize();
      map.fitBounds(SA_BOUNDS, { padding: [0, 0], animate: false });
      const fittedZoom = map.getZoom();
      map.setMinZoom(fittedZoom);
      map.setMaxZoom(fittedZoom);
      map.setMaxBounds(SA_BOUNDS);
    };

    lockToSouthAfrica();
    mapRef.current = map;

    // Full-screen means the viewport (and therefore the map's aspect ratio)
    // can change a lot — window resize, sidebar collapse, phone rotation.
    // Re-fit every time the container itself changes size, not just on
    // window resize, so it always shows exactly South Africa, edge to edge.
    const ro = new ResizeObserver(() => lockToSouthAfrica());
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
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
    <div
      ref={wrapRef}
      // `isolate` gives this card its own stacking context, so Leaflet's
      // internal panes/popups/controls (which use z-index up to 1000
      // internally) are contained inside it and can never climb above the
      // portal's mobile sidebar drawer (z-40) or its backdrop (z-30).
      className={
        className ??
        'relative isolate h-[70vh] max-h-[640px] min-h-[380px] w-full overflow-hidden border border-black/10'
      }
    >
      {/* Dark tooltip chrome reads well over both the light basemap and the
          colored pins, scoped to this map only so nothing else is affected. */}
      <style>{`
        .ops-live-map .leaflet-tooltip {
          background: rgba(10, 10, 10, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          font-weight: 600;
          font-size: 11px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .ops-live-map .leaflet-tooltip-top:before { border-top-color: rgba(10, 10, 10, 0.9); }
      `}</style>

      <div ref={mapElRef} className="ops-live-map h-full w-full" />

      <MapBrandPanel />

      {/* Floating KPI strip — glass pills over the map, top-right on every
          breakpoint so they never fight the brand card (always top-left,
          and compact now rather than a full-width band on mobile). */}
      <div className="pointer-events-none absolute right-3 top-3 z-[3] flex flex-wrap justify-end gap-2">
        {STATUS_ORDER.map((key) => {
          const total = (data ?? []).reduce((s, p) => s + p[key], 0);
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md ring-1 ring-white/10"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
              {STATUS_LABELS[key]}
              <span className="font-bold">{loading ? '–' : total}</span>
            </div>
          );
        })}
      </div>

      {/* Province detail — slides in over the map like a floating card, kept
          to the bottom-left on every screen so it never fights the brand
          card (always top-left) or the KPI strip (always top-right). */}
      {selectedLoc && (
        <div className="absolute bottom-3 left-3 right-3 z-[4] max-w-xs rounded-xl bg-black/80 p-4 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md sm:right-auto">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: BRAND_TEAL }}>
                Province
              </div>
              <p className="text-base font-bold text-white">{selectedLoc.name}</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-white/50 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {!selected || selected.total === 0 ? (
            <p className="text-sm text-white/60">No case files recorded here yet.</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-white">{selected.total}</p>
              <p className="mb-3 text-xs text-white/60">total case files</p>
              <div className="space-y-1.5 text-xs">
                {STATUS_ORDER.map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-white/70">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
                      {STATUS_LABELS[key]}
                    </span>
                    <span className="font-semibold text-white">{selected[key]}</span>
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

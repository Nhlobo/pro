import React, { useMemo, useState } from 'react';
import type { ProvinceStatusData } from '@/hooks/useDashboardStats';

const BRAND_TEAL = '#00BAAD';

// Colors for the three pin categories — kept distinct from the teal brand
// accent so status is legible at a glance against the map.
const STATUS_COLORS = {
  resolved: '#3B8A46',
  inProgress: BRAND_TEAL,
  pending: '#C08A1E',
} as const;

/**
 * Stylised (not survey-accurate) outline of South Africa's nine provinces.
 * Coordinates are hand-drawn to be recognisable and roughly proportional,
 * not a georeferenced trace — good enough for an at-a-glance operations
 * view. Swap `d` values here if a more precise outline is ever needed.
 */
const PROVINCE_SHAPES: { id: string; name: string; d: string; pin: [number, number] }[] = [
  { id: 'limpopo', name: 'Limpopo', d: 'M250,90 320,20 430,15 520,90 480,155 380,140 300,150 255,130 Z', pin: [380, 88] },
  { id: 'north-west', name: 'North West', d: 'M60,90 180,40 250,90 255,130 300,150 290,230 200,255 110,220 70,150 Z', pin: [175, 155] },
  { id: 'gauteng', name: 'Gauteng', d: 'M300,150 365,150 370,195 330,215 290,195 Z', pin: [330, 178] },
  { id: 'mpumalanga', name: 'Mpumalanga', d: 'M370,150 480,155 510,200 480,250 420,270 370,195 Z', pin: [440, 200] },
  { id: 'kwazulu-natal', name: 'KwaZulu-Natal', d: 'M480,250 555,190 600,260 560,345 480,340 420,270 Z', pin: [510, 288] },
  { id: 'free-state', name: 'Free State', d: 'M290,215 370,195 420,270 380,330 300,350 250,290 Z', pin: [325, 272] },
  { id: 'eastern-cape', name: 'Eastern Cape', d: 'M480,340 560,345 515,405 430,460 330,460 300,350 380,330 Z', pin: [420, 400] },
  { id: 'western-cape', name: 'Western Cape', d: 'M250,290 300,350 330,460 225,500 120,470 70,380 150,320 Z', pin: [190, 410] },
  { id: 'northern-cape', name: 'Northern Cape', d: 'M60,90 40,250 70,380 150,320 250,290 290,230 200,255 110,220 70,150 Z', pin: [150, 235] },
];

function pinRadius(count: number): number {
  if (count <= 0) return 0;
  return Math.max(3, Math.min(9, 3 + Math.sqrt(count) / 1.6));
}

interface Props {
  data: ProvinceStatusData[];
  loading?: boolean;
}

const ProvinceCaseMap: React.FC<Props> = ({ data, loading }) => {
  const byName = useMemo(() => {
    const m = new Map<string, ProvinceStatusData>();
    data.forEach((d) => m.set(d.name, d));
    return m;
  }, [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShape = PROVINCE_SHAPES.find((p) => p.id === selectedId) ?? null;
  const selected = selectedShape ? byName.get(selectedShape.name) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
      <div className="border border-black/10 p-3">
        <svg viewBox="0 0 640 560" className="h-auto w-full" role="img" aria-label="Case distribution across South Africa's nine provinces">
          <g stroke="white" strokeWidth={2}>
            {PROVINCE_SHAPES.map((shape) => {
              const isSelected = shape.id === selectedId;
              return (
                <path
                  key={shape.id}
                  d={shape.d}
                  fill={isSelected ? 'rgba(0,186,173,0.16)' : 'rgba(0,0,0,0.035)'}
                  className="cursor-pointer transition-colors hover:fill-[rgba(0,186,173,0.1)]"
                  onClick={() => setSelectedId(shape.id === selectedId ? null : shape.id)}
                >
                  <title>{shape.name}</title>
                </path>
              );
            })}
          </g>
          <g>
            {PROVINCE_SHAPES.map((shape) => {
              const stats = byName.get(shape.name);
              if (!stats || loading) return null;
              const [cx, cy] = shape.pin;
              const offsets: [number, number, number][] = [
                [-8, -4, stats.resolved],
                [8, -4, stats.inProgress],
                [0, 8, stats.pending],
              ];
              const colors = [STATUS_COLORS.resolved, STATUS_COLORS.inProgress, STATUS_COLORS.pending];
              return (
                <g key={shape.id} onClick={() => setSelectedId(shape.id === selectedId ? null : shape.id)} className="cursor-pointer">
                  {offsets.map(([dx, dy, count], i) => (
                    count > 0 && (
                      <circle
                        key={i}
                        cx={cx + dx}
                        cy={cy + dy}
                        r={pinRadius(count)}
                        fill={colors[i]}
                        stroke="white"
                        strokeWidth={1}
                      />
                    )
                  ))}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.resolved }} />
            Resolved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
            In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }} />
            Pending
          </span>
        </div>
      </div>

      <div className="border border-black/10 p-4">
        {!selectedShape ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-black">Select a province</p>
            <p className="text-xs text-slate-500">Tap a province or its pins to see the breakdown.</p>
          </div>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: BRAND_TEAL }}>
              Province
            </div>
            <p className="mb-3 text-base font-bold text-black">{selectedShape.name}</p>
            {!selected || selected.total === 0 ? (
              <p className="text-sm text-slate-500">No case files recorded for this province yet.</p>
            ) : (
              <>
                <p className="text-2xl font-bold text-black">{selected.total}</p>
                <p className="mb-4 text-xs text-slate-500">total case files</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.resolved }} />
                      Resolved
                    </span>
                    <span className="font-semibold text-black">{selected.resolved}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
                      In progress
                    </span>
                    <span className="font-semibold text-black">{selected.inProgress}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }} />
                      Pending
                    </span>
                    <span className="font-semibold text-black">{selected.pending}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProvinceCaseMap;

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IncentiveTier } from '@/hooks/useSalesIncentives';

interface IncentiveSimulatorProps {
  tiers: IncentiveTier[];
  targetAppointments: number;
}

const IncentiveSimulator: React.FC<IncentiveSimulatorProps> = ({ tiers, targetAppointments }) => {
  const [simAppts, setSimAppts] = useState(20);
  const [simRaf, setSimRaf] = useState(20);
  const [simMedneg, setSimMedneg] = useState(20);
  const [simType, setSimType] = useState<'internal' | 'external'>('external');

  const result = useMemo(() => {
    const tier = tiers
      .filter(t => t.tier_type === simType)
      .find(t => simAppts >= t.min_appointments && (t.max_appointments === null || simAppts <= t.max_appointments));

    if (!tier) return { raf: 0, medneg: 0, total: 0, label: 'None', targetMet: false, strikeRisk: true };

    const rafEarnings = Number(tier.raf_amount);
    const mednegEarnings = Number(tier.medneg_amount);

    return {
      raf: rafEarnings,
      medneg: mednegEarnings,
      total: rafEarnings + mednegEarnings,
      label: tier.label || 'Tier',
      targetMet: simAppts >= targetAppointments,
      strikeRisk: simAppts < targetAppointments,
    };
  }, [simAppts, simType, tiers, targetAppointments]);

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Incentive simulator</h3>

        {/* Inputs row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Appointments</Label>
            <Input
              type="number"
              min={0}
              value={simAppts}
              onChange={e => setSimAppts(Number(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">RAF</Label>
            <Input
              type="number"
              min={0}
              value={simRaf}
              onChange={e => setSimRaf(Number(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Med Neg</Label>
            <Input
              type="number"
              min={0}
              value={simMedneg}
              onChange={e => setSimMedneg(Number(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
            />
          </div>
        </div>

        {/* Type selector */}
        <div className="mb-5">
          <Select value={simType} onValueChange={(v) => setSimType(v as 'internal' | 'external')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge variant="default" className="text-xs">{result.label}</Badge>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">RAF earnings</p>
            <p className="text-lg font-bold text-primary">R{result.raf.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Med Neg earnings</p>
            <p className="text-lg font-bold text-primary">R{result.medneg.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Total earned</p>
            <p className="text-lg font-bold text-foreground">R{result.total.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Target met?</p>
            <span className={`text-sm font-semibold ${result.targetMet ? 'text-primary' : 'text-destructive'}`}>
              {result.targetMet ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground mb-1">Strike risk?</p>
            <span className={`text-sm font-semibold ${result.strikeRisk ? 'text-destructive' : 'text-primary'}`}>
              {result.strikeRisk ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncentiveSimulator;

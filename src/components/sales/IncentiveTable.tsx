import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X } from 'lucide-react';
import { IncentiveTier } from '@/hooks/useSalesIncentives';
import { toast } from 'sonner';

interface IncentiveTableProps {
  tiers: IncentiveTier[];
  activeAppointments?: number;
  consultantType?: 'internal' | 'external';
  showBothTypes?: boolean;
  isAdmin?: boolean;
  onUpdateTier?: (tierId: string, updates: Partial<IncentiveTier>) => Promise<{ error: any }>;
}

const IncentiveTable: React.FC<IncentiveTableProps> = ({
  tiers,
  activeAppointments = 0,
  consultantType = 'internal',
  showBothTypes = false,
  isAdmin = false,
  onUpdateTier,
}) => {
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editRaf, setEditRaf] = useState('');
  const [editMedneg, setEditMedneg] = useState('');

  // Always show both types
  const displayTiers = showBothTypes ? tiers : tiers;

  const isActiveRow = (tier: IncentiveTier) => {
    if (showBothTypes && !consultantType) return false;
    if (tier.tier_type !== consultantType) return false;
    return activeAppointments >= tier.min_appointments &&
      (tier.max_appointments === null || activeAppointments <= tier.max_appointments);
  };

  const formatRange = (min: number, max: number | null) =>
    max === null ? `${min}+` : min === max ? `${min}` : `${min}–${max}`;

  const startEditing = (tier: IncentiveTier) => {
    setEditingTierId(tier.id);
    setEditRaf(String(tier.raf_amount));
    setEditMedneg(String(tier.medneg_amount));
  };

  const cancelEditing = () => {
    setEditingTierId(null);
    setEditRaf('');
    setEditMedneg('');
  };

  const saveEditing = async (tierId: string) => {
    if (!onUpdateTier) return;
    const rafVal = parseFloat(editRaf);
    const mednegVal = parseFloat(editMedneg);
    if (isNaN(rafVal) || isNaN(mednegVal) || rafVal < 0 || mednegVal < 0) {
      toast.error('Please enter valid positive amounts');
      return;
    }
    const { error } = await onUpdateTier(tierId, { raf_amount: rafVal, medneg_amount: mednegVal });
    if (error) {
      toast.error('Failed to update tier');
    } else {
      toast.success('Incentive tier updated');
      cancelEditing();
    }
  };

  // Group by type for display
  const internalTiers = displayTiers.filter(t => t.tier_type === 'internal');
  const externalTiers = displayTiers.filter(t => t.tier_type === 'external');

  const renderRows = (tiersList: IncentiveTier[]) =>
    tiersList.map((tier) => (
      <TableRow
        key={tier.id}
        className={isActiveRow(tier) ? 'bg-primary/10 border-l-4 border-l-primary font-semibold' : ''}
      >
        <TableCell>{formatRange(tier.min_appointments, tier.max_appointments)}</TableCell>
        <TableCell>
          <Badge variant={isActiveRow(tier) ? 'default' : 'secondary'} className="text-xs">
            {tier.label || 'Tier'}
            {isActiveRow(tier) && ' ✓'}
          </Badge>
        </TableCell>
        <TableCell className="text-blue-600 dark:text-blue-400 font-medium">
          {editingTierId === tier.id ? (
            <Input
              type="number"
              value={editRaf}
              onChange={(e) => setEditRaf(e.target.value)}
              className="w-24 h-7 text-sm"
              min={0}
            />
          ) : (
            `R${Number(tier.raf_amount).toLocaleString()}`
          )}
        </TableCell>
        <TableCell className="text-teal-600 dark:text-teal-400 font-medium">
          {editingTierId === tier.id ? (
            <Input
              type="number"
              value={editMedneg}
              onChange={(e) => setEditMedneg(e.target.value)}
              className="w-24 h-7 text-sm"
              min={0}
            />
          ) : (
            `R${Number(tier.medneg_amount).toLocaleString()}`
          )}
        </TableCell>
        {isAdmin && (
          <TableCell>
            {editingTierId === tier.id ? (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEditing(tier.id)}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditing}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(tier)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>
    ));

  const allTiers = [...internalTiers, ...externalTiers];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Incentive Structure</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appointments</TableHead>
              <TableHead>Status</TableHead>
              
              <TableHead className="text-blue-600 dark:text-blue-400 font-semibold">RAF Incentive</TableHead>
              <TableHead className="text-teal-600 dark:text-teal-400 font-semibold">Med Neg Incentive</TableHead>
              {isAdmin && <TableHead className="w-16">Edit</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTiers.length > 0 ? (
              renderRows(allTiers)
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                  No incentive tiers configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default IncentiveTable;

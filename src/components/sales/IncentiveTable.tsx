import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IncentiveTier } from '@/hooks/useSalesIncentives';

interface IncentiveTableProps {
  tiers: IncentiveTier[];
  activeAppointments?: number;
  consultantType?: 'internal' | 'external';
  showBothTypes?: boolean;
}

const IncentiveTable: React.FC<IncentiveTableProps> = ({
  tiers,
  activeAppointments = 0,
  consultantType = 'internal',
  showBothTypes = false,
}) => {
  const filteredTiers = showBothTypes ? tiers : tiers.filter(t => t.tier_type === consultantType);

  const isActiveRow = (tier: IncentiveTier) => {
    if (showBothTypes) return false;
    return activeAppointments >= tier.min_appointments &&
      (tier.max_appointments === null || activeAppointments <= tier.max_appointments);
  };

  const formatRange = (min: number, max: number | null) =>
    max === null ? `${min}+` : min === max ? `${min}` : `${min}–${max}`;

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
              {showBothTypes && <TableHead>Type</TableHead>}
              <TableHead className="text-blue-600 dark:text-blue-400 font-semibold">
                {showBothTypes ? 'RAF Incentive' : consultantType === 'internal' ? 'RAF Incentive' : 'RAF Commission'}
              </TableHead>
              <TableHead className="text-teal-600 dark:text-teal-400 font-semibold">
                {showBothTypes ? 'Med Neg Incentive' : consultantType === 'internal' ? 'Med Neg Incentive' : 'Med Neg Commission'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTiers.map((tier) => (
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
                {showBothTypes && (
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {tier.tier_type === 'internal' ? 'Internal' : 'External'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-blue-600 dark:text-blue-400 font-medium">
                  R{Number(tier.raf_amount).toLocaleString()}
                </TableCell>
                <TableCell className="text-teal-600 dark:text-teal-400 font-medium">
                  R{Number(tier.medneg_amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {filteredTiers.length === 0 && (
              <TableRow>
                <TableCell colSpan={showBothTypes ? 5 : 4} className="text-center text-muted-foreground py-8">
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

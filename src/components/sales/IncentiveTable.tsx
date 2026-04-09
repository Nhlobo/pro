import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Pencil, Check, X, AlertTriangle, CalendarClock, Banknote, PercentCircle, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { IncentiveTier } from '@/hooks/useSalesIncentives';
import { toast } from 'sonner';

interface IncentiveTableProps {
  tiers: IncentiveTier[];
  isAdmin?: boolean;
  onUpdateTier?: (tierId: string, updates: Partial<IncentiveTier>) => Promise<{ error: any }>;
}

const IncentiveTable: React.FC<IncentiveTableProps> = ({
  tiers,
  isAdmin = false,
  onUpdateTier,
}) => {
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editRaf, setEditRaf] = useState('');
  const [editMedneg, setEditMedneg] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const [rulesOpen, setRulesOpen] = useState(true);

  const incentiveRules = [
    {
      icon: CalendarClock,
      title: 'Monthly Submission Deadline',
      description: 'All incentive claims must be submitted before the 25th of each month to be paid in the same month. Late submissions will roll over to the following pay cycle.',
      severity: 'warning' as const,
    },
    {
      icon: ShieldAlert,
      title: '"Scratch My Back" Penalty',
      description: 'Any "Scratch my back" arrangement identified will result in a 10% deduction from your total incentive payout for that month.',
      severity: 'destructive' as const,
    },
    {
      icon: PercentCircle,
      title: 'Excessive Discount Penalty',
      description: 'Applying discounts more than twice in a calendar month will trigger a 10% reduction in your incentive earnings. Discounts must be pre-approved and documented.',
      severity: 'destructive' as const,
    },
    {
      icon: Banknote,
      title: 'Commission Payment Trigger',
      description: 'Commission is payable upon receipt of either a deposit or full payment — whichever occurs first. No commission is earned until payment is confirmed.',
      severity: 'info' as const,
    },
    {
      icon: Banknote,
      title: 'AOD Deal Commission',
      description: 'For Acknowledgment of Debt (AOD) deals, commission is only payable once a deposit has been received and recorded in the system.',
      severity: 'info' as const,
    },
  ];

  const formatRange = (min: number, max: number | null) => {
    return max === null ? `${min}+` : min === max ? `${min}` : `${min}-${max}`;
  };

  const startEditing = (tier: IncentiveTier) => {
    setEditingTierId(tier.id);
    setEditRaf(String(tier.raf_amount));
    setEditMedneg(String(tier.medneg_amount));
    setEditMin(String(tier.min_appointments));
    setEditMax(tier.max_appointments === null ? '' : String(tier.max_appointments));
  };

  const cancelEditing = () => {
    setEditingTierId(null);
    setEditRaf('');
    setEditMedneg('');
    setEditMin('');
    setEditMax('');
  };

  const saveEditing = async (tierId: string) => {
    if (!onUpdateTier) return;
    const rafVal = parseFloat(editRaf);
    const mednegVal = parseFloat(editMedneg);
    const minVal = parseInt(editMin);
    const maxVal = editMax === '' ? null : parseInt(editMax);
    if (isNaN(rafVal) || isNaN(mednegVal) || rafVal < 0 || mednegVal < 0) {
      toast.error('Please enter valid positive amounts');
      return;
    }
    if (isNaN(minVal) || minVal < 0) {
      toast.error('Please enter a valid minimum appointment value');
      return;
    }
    if (maxVal !== null && (isNaN(maxVal) || maxVal < minVal)) {
      toast.error('Maximum must be greater than or equal to minimum');
      return;
    }
    const { error } = await onUpdateTier(tierId, {
      raf_amount: rafVal,
      medneg_amount: mednegVal,
      min_appointments: minVal,
      max_appointments: maxVal,
    });
    if (error) {
      toast.error('Failed to update tier');
    } else {
      toast.success('Incentive tier updated');
      cancelEditing();
    }
  };

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
            {tiers.length > 0 ? (
              tiers.filter(tier => tier.raf_amount > 0 || tier.medneg_amount > 0 || editingTierId === tier.id || isAdmin).map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    {editingTierId === tier.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editMin}
                          onChange={(e) => setEditMin(e.target.value)}
                          className="w-16 h-7 text-sm"
                          min={0}
                          placeholder="Min"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="number"
                          value={editMax}
                          onChange={(e) => setEditMax(e.target.value)}
                          className="w-16 h-7 text-sm"
                          min={0}
                          placeholder="∞"
                        />
                      </div>
                    ) : (
                      formatRange(tier.min_appointments, tier.max_appointments)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-xs">
                      {tier.label || 'Tier'}
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
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                  No incentive tiers configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Separator />

        {/* Incentive Rules Section */}
        <div className="px-4 py-3">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setRulesOpen(!rulesOpen)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-foreground">Incentive Rules & Conditions</h4>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">{incentiveRules.length} rules</Badge>
              {rulesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {rulesOpen && (
            <div className="mt-3 space-y-2">
              {incentiveRules.map((rule, idx) => {
                const Icon = rule.icon;
                const borderColor = rule.severity === 'destructive'
                  ? 'border-l-destructive bg-destructive/5'
                  : rule.severity === 'warning'
                    ? 'border-l-amber-500 bg-amber-500/5'
                    : 'border-l-primary bg-primary/5';
                return (
                  <div
                    key={idx}
                    className={`border-l-[3px] rounded-r-md p-3 ${borderColor}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{rule.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
                      </div>
                      {rule.severity === 'destructive' && (
                        <Badge variant="destructive" className="text-[9px] shrink-0 ml-auto">Penalty</Badge>
                      )}
                      {rule.severity === 'warning' && (
                        <Badge className="text-[9px] shrink-0 ml-auto bg-amber-500 hover:bg-amber-600 text-white">Deadline</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IncentiveTable;

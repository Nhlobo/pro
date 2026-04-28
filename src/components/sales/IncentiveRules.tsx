import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarClock, Banknote, PercentCircle, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

const incentiveRules = [
  {
    icon: CalendarClock,
    title: 'Commission Payout Period',
    description: 'Commission runs from the 26th to the 25th. Deals closed from 26 March to 25 April qualify for the April payout, and 26 April to 25 May qualify for the May payout.',
    severity: 'warning' as const,
  },
  {
    icon: ShieldAlert,
    title: 'Strike Issue Date',
    description: 'From April onward, a strike is issued on the 25th if a sales consultant has not reached the monthly target of 7 qualifying closed deals. Warnings are sent to the consultant user email.',
    severity: 'destructive' as const,
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

const IncentiveRules: React.FC = () => {
  const [rulesOpen, setRulesOpen] = useState(true);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setRulesOpen(!rulesOpen)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-lg">Incentive Rules & Conditions</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{incentiveRules.length} rules</Badge>
            {rulesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      {rulesOpen && (
        <CardContent className="space-y-2">
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
        </CardContent>
      )}
    </Card>
  );
};

export default IncentiveRules;

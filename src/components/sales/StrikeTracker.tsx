import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConsultantStrike } from '@/hooks/useSalesIncentives';

interface StrikeTrackerProps {
  strikes: ConsultantStrike[];
  maxStrikes?: number;
}

const STRIKE_DEFINITIONS = [
  { number: 1, type: 'verbal', label: 'verbal warning', legend: 'Verbal warning' },
  { number: 2, type: 'written', label: 'written warning', legend: 'Written warning' },
  { number: 3, type: 'dismissal', label: 'dismissal', legend: 'Dismissal / contract end' },
];

const StrikeTracker: React.FC<StrikeTrackerProps> = ({ strikes }) => {
  const today = new Date();

  const getDaysRemaining = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const activeStrikes = strikes.filter(s => !s.expired);

  const getStrikeForType = (type: string) =>
    activeStrikes.find(s => s.type === type);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Strike tracker — issued on the 25th</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Strike rows */}
        <div className="divide-y divide-border">
          {STRIKE_DEFINITIONS.map((def) => {
            const strike = getStrikeForType(def.type);
            const isActive = !!strike;
            const daysLeft = strike ? getDaysRemaining(strike.expiry_date) : 0;

            return (
              <div key={def.number} className="flex items-start justify-between py-4">
                <div className="flex items-start gap-4">
                  <span className="text-sm font-medium text-muted-foreground mt-0.5">{def.number}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Strike {def.number} — {def.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isActive
                        ? `Issued ${formatDate(strike.issued_date)} → expires ${formatDate(strike.expiry_date)} (${daysLeft} days left)`
                        : 'Not yet triggered'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isActive ? 'destructive' : 'secondary'}
                  className="text-xs shrink-0"
                >
                  {isActive ? 'Active' : 'Pending'}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-4 mt-2 border-t border-border space-y-1">
          {STRIKE_DEFINITIONS.map((def) => (
            <p key={def.number} className="text-xs text-muted-foreground">
              <span className={`font-semibold ${
                def.type === 'verbal' ? 'text-yellow-600 dark:text-yellow-400' :
                def.type === 'written' ? 'text-orange-600 dark:text-orange-400' :
                'text-destructive'
              }`}>
                Strike {def.number}
              </span>
              {' → '}{def.legend}
            </p>
          ))}
          <p className="text-xs text-muted-foreground font-medium pt-1">
            From April onward, strikes are issued on the 25th for the 25th–24th payout period when fewer than 6 deals are closed, and expire automatically after 120 days
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StrikeTracker;

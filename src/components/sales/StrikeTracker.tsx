import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, ShieldAlert, XCircle } from 'lucide-react';
import { ConsultantStrike } from '@/hooks/useSalesIncentives';

interface StrikeTrackerProps {
  strikes: ConsultantStrike[];
  maxStrikes?: number;
}

const StrikeTracker: React.FC<StrikeTrackerProps> = ({ strikes, maxStrikes = 3 }) => {
  const today = new Date();

  const getStrikeIcon = (type: string) => {
    switch (type) {
      case 'verbal': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'written': return <ShieldAlert className="h-4 w-4 text-orange-500" />;
      case 'dismissal': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStrikeBadgeVariant = (type: string, expired: boolean) => {
    if (expired) return 'secondary' as const;
    switch (type) {
      case 'verbal': return 'default' as const;
      case 'written': return 'destructive' as const;
      case 'dismissal': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  const getDaysRemaining = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getExpiryProgress = (issuedDate: string, expiryDate: string) => {
    const issued = new Date(issuedDate).getTime();
    const expiry = new Date(expiryDate).getTime();
    const total = expiry - issued;
    const elapsed = today.getTime() - issued;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const activeStrikes = strikes.filter(s => !s.expired);
  const expiredStrikes = strikes.filter(s => s.expired);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Strike Tracker</CardTitle>
          <Badge variant={activeStrikes.length >= maxStrikes ? 'destructive' : activeStrikes.length > 0 ? 'default' : 'secondary'}>
            {activeStrikes.length}/{maxStrikes} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {strikes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No strikes on record ✓</p>
        )}

        {/* Active strikes */}
        {activeStrikes.map((strike) => {
          const daysLeft = getDaysRemaining(strike.expiry_date);
          const progress = getExpiryProgress(strike.issued_date, strike.expiry_date);
          return (
            <div key={strike.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStrikeIcon(strike.type)}
                  <span className="font-medium capitalize text-sm">{strike.type} Warning</span>
                </div>
                <Badge variant={getStrikeBadgeVariant(strike.type, false)} className="text-xs">
                  {daysLeft <= 14 ? `${daysLeft}d left` : 'Active'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Issued: {new Date(strike.issued_date).toLocaleDateString()}</span>
                  <span>Expires: {new Date(strike.expiry_date).toLocaleDateString()}</span>
                </div>
                {strike.reason && <p className="italic">{strike.reason}</p>}
              </div>
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-right text-muted-foreground">{daysLeft} days remaining</p>
              </div>
            </div>
          );
        })}

        {/* Expired strikes */}
        {expiredStrikes.map((strike) => (
          <div key={strike.id} className="border rounded-lg p-3 opacity-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStrikeIcon(strike.type)}
                <span className="font-medium capitalize text-sm line-through">{strike.type} Warning</span>
              </div>
              <Badge variant="secondary" className="text-xs">Expired</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Issued: {new Date(strike.issued_date).toLocaleDateString()} • Expired: {new Date(strike.expiry_date).toLocaleDateString()}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default StrikeTracker;

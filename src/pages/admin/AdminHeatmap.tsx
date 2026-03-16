import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

const provinces = [
  { name: 'Gauteng', experts: 42, demand: 38, status: 'balanced', color: 'bg-success' },
  { name: 'Western Cape', experts: 28, demand: 25, status: 'balanced', color: 'bg-success' },
  { name: 'KwaZulu-Natal', experts: 8, demand: 22, status: 'critical', color: 'bg-destructive' },
  { name: 'Eastern Cape', experts: 5, demand: 14, status: 'shortage', color: 'bg-destructive' },
  { name: 'Free State', experts: 6, demand: 8, status: 'low', color: 'bg-warning' },
  { name: 'Mpumalanga', experts: 4, demand: 7, status: 'low', color: 'bg-warning' },
  { name: 'Limpopo', experts: 3, demand: 5, status: 'low', color: 'bg-warning' },
  { name: 'North West', experts: 3, demand: 4, status: 'low', color: 'bg-warning' },
  { name: 'Northern Cape', experts: 2, demand: 2, status: 'balanced', color: 'bg-success' },
];

const AdminHeatmap: React.FC = () => {
  const criticalRegions = provinces.filter(p => p.status === 'critical' || p.status === 'shortage');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">National Availability Heatmap</h1>
        <p className="text-sm text-muted-foreground">Regional expert availability and shortage alerts</p>
      </div>

      {/* Alerts */}
      {criticalRegions.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-foreground">Regional Shortage Alerts</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {criticalRegions.map(r => (
                <Badge key={r.name} variant="destructive" className="text-xs">
                  {r.name}: {r.experts} experts / {r.demand} demand
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {provinces.map((prov) => {
          const ratio = prov.experts / Math.max(prov.demand, 1);
          return (
            <Card key={prov.name} className={`border-border/50 ${prov.status === 'critical' ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{prov.name}</span>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${prov.color}`} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{prov.experts}</p>
                    <p className="text-[10px] text-muted-foreground">Experts</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{prov.demand}</p>
                    <p className="text-[10px] text-muted-foreground">Demand</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${prov.color}`}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Coverage: {Math.round(ratio * 100)}%
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminHeatmap;

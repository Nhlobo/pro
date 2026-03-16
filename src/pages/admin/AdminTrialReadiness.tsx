import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Scale, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

const mockCases = [
  { id: 'TR-001', claimant: 'J. Mokoena', expert: 'Dr. Smith', reportsNeeded: 3, reportsSubmitted: 3, ready: true },
  { id: 'TR-002', claimant: 'S. Naidoo', expert: 'Dr. Patel', reportsNeeded: 2, reportsSubmitted: 1, ready: false },
  { id: 'TR-003', claimant: 'M. van der Berg', expert: 'Dr. Jones', reportsNeeded: 4, reportsSubmitted: 2, ready: false },
  { id: 'TR-004', claimant: 'T. Dlamini', expert: 'Dr. Nkosi', reportsNeeded: 2, reportsSubmitted: 2, ready: true },
  { id: 'TR-005', claimant: 'R. Pillay', expert: 'Dr. Williams', reportsNeeded: 3, reportsSubmitted: 0, ready: false },
];

const AdminTrialReadiness: React.FC = () => {
  const readyCases = mockCases.filter(c => c.ready).length;
  const totalCases = mockCases.length;
  const readinessRate = Math.round((readyCases / totalCases) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trial Readiness Dashboard</h1>
        <p className="text-sm text-muted-foreground">Expert requirements vs reports submitted</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-primary">{readinessRate}%</p>
            <p className="text-xs text-muted-foreground">Overall Readiness</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-success">{readyCases}</p>
            <p className="text-xs text-muted-foreground">Trial Ready</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-3xl font-bold text-warning">{totalCases - readyCases}</p>
            <p className="text-xs text-muted-foreground">Reports Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Case List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Case Trial Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Case</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claimant</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expert</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reports</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockCases.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{c.id}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{c.claimant}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.expert}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Progress value={(c.reportsSubmitted / c.reportsNeeded) * 100} className="h-2 w-20" />
                      <span className="text-xs text-muted-foreground">{c.reportsSubmitted}/{c.reportsNeeded}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {c.ready ? (
                      <Badge className="bg-success/10 text-success text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Ready
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/10 text-warning text-[10px]">
                        <AlertCircle className="h-3 w-3 mr-1" />Pending
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTrialReadiness;

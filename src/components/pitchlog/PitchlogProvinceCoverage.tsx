import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { MapPin, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Phone, Scale, Stethoscope, Layers, Ban } from 'lucide-react';
import { PitchEntry } from '@/components/pitchlog/PitchlogInlineRow';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

interface PitchlogProvinceCoverageProps {
  entries: PitchEntry[];
}

type PerformanceLevel = 'excellent' | 'good' | 'average' | 'poor' | 'no_activity';

function getPerformanceLevel(conversionRate: number, totalCalls: number): PerformanceLevel {
  if (totalCalls === 0) return 'no_activity';
  if (conversionRate >= 20) return 'excellent';
  if (conversionRate >= 10) return 'good';
  if (conversionRate >= 5) return 'average';
  return 'poor';
}

function getPerformanceBadge(level: PerformanceLevel) {
  switch (level) {
    case 'excellent':
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[11px]"><CheckCircle className="h-3 w-3 mr-1" />Excellent</Badge>;
    case 'good':
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[11px]"><TrendingUp className="h-3 w-3 mr-1" />Good</Badge>;
    case 'average':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[11px]"><AlertTriangle className="h-3 w-3 mr-1" />Average</Badge>;
    case 'poor':
      return <Badge className="bg-red-500/15 text-red-700 border-red-500/30 text-[11px]"><TrendingDown className="h-3 w-3 mr-1" />Needs Work</Badge>;
    case 'no_activity':
      return <Badge variant="outline" className="text-muted-foreground text-[11px]">No Activity</Badge>;
  }
}

function getMainFocus(raf: number, medNeg: number, both: number, notApplicable: number): string {
  const max = Math.max(raf, medNeg, both, notApplicable);
  if (max === 0) return '—';
  if (notApplicable >= raf && notApplicable >= medNeg && notApplicable >= both) return 'Not Applicable';
  if (both >= raf && both >= medNeg) return 'Both RAF & Med Neg';
  if (raf >= medNeg) return 'RAF';
  return 'Medical Negligence';
}

function getMainFocusBadge(focus: string) {
  switch (focus) {
    case 'RAF':
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-[11px]"><Scale className="h-3 w-3 mr-1" />RAF</Badge>;
    case 'Medical Negligence':
      return <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 text-[11px]"><Stethoscope className="h-3 w-3 mr-1" />Med Neg</Badge>;
    case 'Both RAF & Med Neg':
      return <Badge className="bg-teal-500/15 text-teal-700 border-teal-500/30 text-[11px]"><Layers className="h-3 w-3 mr-1" />Both</Badge>;
    case 'Not Applicable':
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[11px]"><Ban className="h-3 w-3 mr-1" />N/A</Badge>;
    default:
      return <span className="text-muted-foreground text-xs">—</span>;
  }
}

const PitchlogProvinceCoverage: React.FC<PitchlogProvinceCoverageProps> = ({ entries }) => {
  const provinceData = useMemo(() => {
    const data = PROVINCES.map(province => {
      const provinceEntries = entries.filter(e => e.province === province);
      const totalCalls = provinceEntries.length;
      const dealsClosed = provinceEntries.filter(e => e.deal_closed === true).length;
      const rafPitches = provinceEntries.filter(e => e.practice_area === 'RAF').length;
      const medNegPitches = provinceEntries.filter(e => e.practice_area === 'Medical Negligence').length;
      const bothPitches = provinceEntries.filter(e => e.practice_area === 'Both RAF & Med Neg').length;
      const notApplicablePitches = provinceEntries.filter(e => e.practice_area === 'Not Applicable' || e.practice_area === 'Other Service').length;
      const conversionRate = totalCalls > 0 ? (dealsClosed / totalCalls) * 100 : 0;
      const level = getPerformanceLevel(conversionRate, totalCalls);
      const mainFocus = getMainFocus(rafPitches, medNegPitches, bothPitches, notApplicablePitches);

      return {
        province,
        totalCalls,
        dealsClosed,
        rafPitches,
        medNegPitches,
        bothPitches,
        notApplicablePitches,
        conversionRate,
        level,
        mainFocus,
      };
    });

    return data.sort((a, b) => b.totalCalls - a.totalCalls);
  }, [entries]);

  const maxCalls = Math.max(...provinceData.map(d => d.totalCalls), 1);
  const totalCalls = provinceData.reduce((s, d) => s + d.totalCalls, 0);
  const totalDeals = provinceData.reduce((s, d) => s + d.dealsClosed, 0);
  const totalRaf = provinceData.reduce((s, d) => s + d.rafPitches, 0);
  const totalMedNeg = provinceData.reduce((s, d) => s + d.medNegPitches, 0);
  const totalBoth = provinceData.reduce((s, d) => s + d.bothPitches, 0);
  const totalNotApplicable = provinceData.reduce((s, d) => s + d.notApplicablePitches, 0);
  const activeProvinces = provinceData.filter(d => d.totalCalls > 0).length;
  const needsWorkProvinces = provinceData.filter(d => d.level === 'poor' || d.level === 'no_activity');

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalCalls}</p>
            <p className="text-xs text-muted-foreground">Total Calls Made</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-2xl font-bold text-emerald-600">{totalDeals}</p>
            <p className="text-xs text-muted-foreground">Deals Closed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Scale className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold text-blue-600">{totalRaf}</p>
            <p className="text-xs text-muted-foreground">RAF Pitches</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Stethoscope className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-2xl font-bold text-purple-600">{totalMedNeg}</p>
            <p className="text-xs text-muted-foreground">Med Neg Pitches</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Layers className="h-5 w-5 mx-auto mb-1 text-teal-600" />
            <p className="text-2xl font-bold text-teal-600">{totalBoth}</p>
            <p className="text-xs text-muted-foreground">Both RAF & Med Neg</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <MapPin className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold text-amber-600">{activeProvinces}/9</p>
            <p className="text-xs text-muted-foreground">Active Provinces</p>
          </CardContent>
        </Card>
      </div>

      {/* Province Table */}
      <Card className="border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Province Coverage Breakdown
          </CardTitle>
          <CardDescription>Calls, deals, and practice area focus per province</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Province</TableHead>
                  <TableHead className="text-center">Total Calls</TableHead>
                  <TableHead className="text-center">Deals Closed</TableHead>
                  <TableHead className="text-center">RAF</TableHead>
                  <TableHead className="text-center">Med Neg</TableHead>
                  <TableHead className="text-center">Both</TableHead>
                  <TableHead className="text-center">Conversion %</TableHead>
                  <TableHead className="text-center">Main Focus</TableHead>
                  <TableHead className="w-[120px]">Volume</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provinceData.map(d => (
                  <TableRow
                    key={d.province}
                    className={
                      d.level === 'excellent' ? 'bg-emerald-500/5' :
                      d.level === 'poor' ? 'bg-red-500/5' :
                      d.level === 'no_activity' ? 'bg-muted/30' : ''
                    }
                  >
                    <TableCell className="font-medium">{d.province}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{d.totalCalls}</TableCell>
                    <TableCell className="text-center">
                      {d.dealsClosed > 0
                        ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{d.dealsClosed}</Badge>
                        : <span className="text-muted-foreground">0</span>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {d.rafPitches > 0
                        ? <span className="font-semibold text-blue-600">{d.rafPitches}</span>
                        : <span className="text-muted-foreground">0</span>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {d.medNegPitches > 0
                        ? <span className="font-semibold text-purple-600">{d.medNegPitches}</span>
                        : <span className="text-muted-foreground">0</span>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {d.bothPitches > 0
                        ? <span className="font-semibold text-teal-600">{d.bothPitches}</span>
                        : <span className="text-muted-foreground">0</span>
                      }
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {d.totalCalls > 0 ? `${d.conversionRate.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-center">{getMainFocusBadge(d.mainFocus)}</TableCell>
                    <TableCell>
                      <Progress value={(d.totalCalls / maxCalls) * 100} className="h-2" />
                    </TableCell>
                    <TableCell className="text-center">{getPerformanceBadge(d.level)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Needs Improvement Alert */}
      {needsWorkProvinces.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Provinces Needing Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {needsWorkProvinces.map(d => (
                <Badge key={d.province} variant="outline" className="text-amber-700 border-amber-500/40 text-xs">
                  {d.province}: {d.totalCalls} calls, {d.dealsClosed} deals
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These provinces have low or no activity. Consider increasing outreach efforts to improve coverage.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PitchlogProvinceCoverage;

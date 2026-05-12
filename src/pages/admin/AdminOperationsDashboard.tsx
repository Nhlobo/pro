import React from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Calendar, FileText, Clock, TrendingUp, TrendingDown, BarChart3,
  AlertTriangle, CheckCircle2, FileSignature, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

const CASE_TYPE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--kutlwano-purple))',
  'hsl(var(--kutlwano-gold))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
];

const CASE_TYPE_BG_CLASSES = [
  'bg-primary',
  'bg-secondary',
  'bg-kutlwano-purple',
  'bg-kutlwano-gold',
  'bg-info',
  'bg-success',
  'bg-warning',
];

const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

function YoYBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (previous === 0) return <ArrowUpRight className="h-3 w-3 text-success" />;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  const isUp = pctChange >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${isUp ? 'text-success' : 'text-destructive'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{pctChange}%
    </span>
  );
}

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();

  const statCards = [
    { label: 'Active Cases', value: stats.totalClaimants, prevValue: null, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Appointments', value: stats.totalAppointments, prevValue: stats.totalAppointmentsLastYear, icon: Calendar, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Pending Reports', value: stats.pendingReports, prevValue: stats.pendingReportsLastYear, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'In Progress', value: stats.reportsInProgress, prevValue: stats.reportsInProgressLastYear, icon: FileText, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Reports Out', value: stats.reportsTakenOut, prevValue: stats.reportsTakenOutLastYear, icon: FileSignature, color: 'text-kutlwano-purple', bg: 'bg-kutlwano-purple/10' },
    { label: 'Completed', value: stats.completedAssessments, prevValue: stats.completedAssessmentsLastYear, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  ];

  const totalCaseTypes = stats.caseTypeData.reduce((s, c) => s + c.count, 0);
  const totalCaseTypesLastYear = stats.caseTypeData.reduce((s, c) => s + c.countLastYear, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Live case load overview and operational metrics</p>
        </div>
        <Badge variant="outline" className="text-xs self-start sm:self-auto">
          {lastYear} vs {currentYear}
        </Badge>
      </div>

      {/* KPI Cards with YoY */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="pt-3 pb-3 px-3 md:px-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 md:p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                {stat.prevValue !== null && !loading && (
                  <YoYBadge current={stat.value} previous={stat.prevValue} />
                )}
                {stat.prevValue === null && <TrendingUp className="h-3 w-3 text-success" />}
              </div>
              <p className={`text-xl md:text-2xl font-bold ${stat.color} tabular-nums`}>
                {loading ? '–' : stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
              {stat.prevValue !== null && !loading && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {lastYear}: {stat.prevValue}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Provincial Bar Chart - LIVE DATA with Year Comparison */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Provincial Case Distribution
              <Badge variant="outline" className="ml-auto text-[10px]">
                {lastYear} vs {currentYear}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : stats.provincialData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No provincial data available</p>
            ) : (
              <>
                <div className="space-y-3">
                  {stats.provincialData.map((prov) => {
                    const maxCases = Math.max(
                      ...stats.provincialData.map(p => Math.max(p.cases, p.casesLastYear))
                    ) || 1;
                    return (
                      <div key={prov.name} className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <span className="text-xs text-muted-foreground sm:w-28 truncate">{prov.name}</span>
                          <div className="flex items-center gap-2 sm:gap-3 text-[10px] flex-wrap">
                            <span className="text-muted-foreground">
                              {lastYear}: <span className="font-medium text-foreground">{prov.casesLastYear}</span>
                            </span>
                            <span className="text-muted-foreground">
                              {currentYear}: <span className="font-medium text-primary">{prov.cases}</span>
                            </span>
                            {prov.casesLastYear > 0 && (
                              <span className={`font-semibold ${prov.cases >= prov.casesLastYear ? 'text-success' : 'text-destructive'}`}>
                                {prov.cases >= prov.casesLastYear ? '+' : ''}{Math.round(((prov.cases - prov.casesLastYear) / prov.casesLastYear) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Last year bar */}
                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground/30 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max((prov.casesLastYear / maxCases) * 100, 3)}%` }}
                          />
                        </div>
                        {/* Current year bar */}
                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700"
                            style={{ width: `${Math.max((prov.cases / maxCases) * 100, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 justify-center border-t border-border/50 pt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground">{lastYear}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-primary to-secondary" />
                    <span className="text-[10px] text-muted-foreground">{currentYear}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Case Type Breakdown with YoY comparison */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" />
              Case Type Breakdown
              <Badge variant="outline" className="ml-auto text-[10px]">
                {lastYear} vs {currentYear}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : stats.caseTypeData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No case type data available</p>
            ) : (
              <div className="space-y-4">
                {/* Summary totals */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">{totalCaseTypes}</p>
                    <p className="text-[10px] text-muted-foreground">{currentYear} Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-muted-foreground">{totalCaseTypesLastYear}</p>
                    <p className="text-[10px] text-muted-foreground">{lastYear} Total</p>
                  </div>
                  <div className="text-center">
                    <YoYBadge current={totalCaseTypes} previous={totalCaseTypesLastYear} />
                    <p className="text-[10px] text-muted-foreground">Change</p>
                  </div>
                </div>

                {/* Case type rows */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {stats.caseTypeData.map((ct, i) => {
                    const maxCount = Math.max(...stats.caseTypeData.map(c => Math.max(c.count, c.countLastYear))) || 1;
                    return (
                      <div key={ct.type} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${CASE_TYPE_BG_CLASSES[i % CASE_TYPE_BG_CLASSES.length]}`} />
                            <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{ct.type}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-muted-foreground">{lastYear}: <span className="font-medium">{ct.countLastYear}</span></span>
                            <span className="text-muted-foreground">{currentYear}: <span className="font-medium text-primary">{ct.count}</span></span>
                            {ct.countLastYear > 0 && (
                              <YoYBadge current={ct.count} previous={ct.countLastYear} />
                            )}
                          </div>
                        </div>
                        {/* Last year bar */}
                        <div className="bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-muted-foreground/30 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max((ct.countLastYear / maxCount) * 100, 2)}%` }}
                          />
                        </div>
                        {/* Current year bar */}
                        <div className="bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max((ct.count / maxCount) * 100, 2)}%`,
                              backgroundColor: CASE_TYPE_COLORS[i % CASE_TYPE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 justify-center border-t border-border/50 pt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground">{lastYear}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-[10px] text-muted-foreground">{currentYear}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts - LIVE DATA */}
      {stats.overdueReports > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {stats.overdueReports} report{stats.overdueReports !== 1 ? 's' : ''} overdue — Expert responses pending for more than 30 days
              </p>
            </div>
            <Badge variant="outline" className="border-warning/50 text-warning">Action Required</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOperationsDashboard;
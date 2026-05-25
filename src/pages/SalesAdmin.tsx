import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, AlertTriangle, Settings, Search } from 'lucide-react';
import { useSalesIncentives } from '@/hooks/useSalesIncentives';
import IncentiveTable from '@/components/sales/IncentiveTable';
import StrikeTracker from '@/components/sales/StrikeTracker';
import { toast } from 'sonner';
import SalesPerformanceReports from '@/pages/admin/SalesPerformanceReports';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

const SalesAdmin: React.FC = () => {
  const {
    allConsultants,
    allPerformance,
    allStrikes,
    tiers,
    loading,
    currentMonth,
    currentYear,
    periodStart,
    periodEnd,
    getActiveStrikes,
    getCurrentPerformance,
    calculateIncentive,
    updateTier,
    refetch,
  } = useSalesIncentives();

  const [search, setSearch] = useState('');
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierValues, setTierValues] = useState<Record<string, { raf: string; medneg: string }>>({});
  const [selectedConsultant, setSelectedConsultant] = useState<string | null>(null);

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
  const periodLabel = `${new Date(periodStart).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${new Date(periodEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const filteredConsultants = allConsultants.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.region || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalIncentives = allConsultants.reduce((sum, c) => {
    const perf = getCurrentPerformance(c.id);
    const inc = calculateIncentive(perf?.total_appts || 0, c.type as 'internal' | 'external');
    return sum + inc.total;
  }, 0);

  const totalActive = allConsultants.reduce((sum, c) => sum + getActiveStrikes(c.id).length, 0);

  const handleSaveTier = async (tierId: string) => {
    const vals = tierValues[tierId];
    if (!vals) return;
    const { error } = await updateTier(tierId, {
      raf_amount: parseFloat(vals.raf),
      medneg_amount: parseFloat(vals.medneg),
    });
    if (error) {
      toast.error('Failed to update tier');
    } else {
      toast.success('Tier updated');
      setEditingTier(null);
    }
  };

  const selectedStrikes = selectedConsultant
    ? allStrikes.filter(s => s.consultant_id === selectedConsultant)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Admin</h1>
          <p className="text-muted-foreground">{monthName} payout • {periodLabel} • {allConsultants.length} consultants</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Consultants</p>
                <p className="text-3xl font-bold">{allConsultants.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-70" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Incentives</p>
                <p className="text-3xl font-bold">R{totalIncentives.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-70" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Strikes</p>
                <p className="text-3xl font-bold">{totalActive}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 opacity-70 ${totalActive > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Below Target</p>
                <p className="text-3xl font-bold">
                  {allConsultants.filter(c => (getCurrentPerformance(c.id)?.total_appts || 0) < 7).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-70" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="consultants">
          <TabsList>
            <TabsTrigger value="consultants">Consultants</TabsTrigger>
            <TabsTrigger value="tiers">Incentive Tiers</TabsTrigger>
            <TabsTrigger value="performance-reports">Performance Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="performance-reports" className="space-y-4">
            <SalesPerformanceReports />
          </TabsContent>

          <TabsContent value="consultants" className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or region..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Total Appts</TableHead>
                      <TableHead className="text-blue-600 dark:text-blue-400">RAF Incentive</TableHead>
                      <TableHead className="text-teal-600 dark:text-teal-400">Med Neg Incentive</TableHead>
                      <TableHead>Strikes</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsultants.map(c => {
                      const perf = getCurrentPerformance(c.id);
                      const active = getActiveStrikes(c.id);
                      const inc = calculateIncentive(perf?.total_appts || 0, c.type as 'internal' | 'external');
                      const belowTarget = (perf?.total_appts || 0) < 7;

                      return (
                        <TableRow key={c.id} className={belowTarget ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">{c.type}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.region || '—'}</TableCell>
                          <TableCell>
                            <span className="font-semibold">{perf?.total_appts || 0}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({perf?.raf_appts || 0}R / {perf?.medneg_appts || 0}M)
                            </span>
                          </TableCell>
                          <TableCell className="text-blue-600 dark:text-blue-400 font-medium">
                            R{inc.raf.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-teal-600 dark:text-teal-400 font-medium">
                            R{inc.medneg.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={active.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                              {active.length}/3
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{inc.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedConsultant(c.id)}
                                >
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>{c.name} — Strikes</DialogTitle>
                                </DialogHeader>
                                <StrikeTracker strikes={allStrikes.filter(s => s.consultant_id === c.id)} />
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredConsultants.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No consultants found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Manage Incentive Tiers
                </CardTitle>
                <CardDescription>Edit RAF and Med Neg incentive amounts per tier</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Appointments</TableHead>
                      <TableHead className="text-blue-600 dark:text-blue-400">RAF Amount</TableHead>
                      <TableHead className="text-teal-600 dark:text-teal-400">Med Neg Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{t.tier_type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{t.label}</TableCell>
                        <TableCell>
                          {t.max_appointments ? `${t.min_appointments}–${t.max_appointments}` : `${t.min_appointments}+`}
                        </TableCell>
                        <TableCell>
                          {editingTier === t.id ? (
                            <Input
                              type="number"
                              className="w-24"
                              value={tierValues[t.id]?.raf ?? String(t.raf_amount)}
                              onChange={(e) => setTierValues(prev => ({
                                ...prev,
                                [t.id]: { ...prev[t.id], raf: e.target.value, medneg: prev[t.id]?.medneg ?? String(t.medneg_amount) }
                              }))}
                            />
                          ) : (
                            <span className="text-blue-600 dark:text-blue-400">R{Number(t.raf_amount).toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTier === t.id ? (
                            <Input
                              type="number"
                              className="w-24"
                              value={tierValues[t.id]?.medneg ?? String(t.medneg_amount)}
                              onChange={(e) => setTierValues(prev => ({
                                ...prev,
                                [t.id]: { ...prev[t.id], medneg: e.target.value, raf: prev[t.id]?.raf ?? String(t.raf_amount) }
                              }))}
                            />
                          ) : (
                            <span className="text-teal-600 dark:text-teal-400">R{Number(t.medneg_amount).toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTier === t.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleSaveTier(t.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingTier(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingTier(t.id);
                              setTierValues(prev => ({
                                ...prev,
                                [t.id]: { raf: String(t.raf_amount), medneg: String(t.medneg_amount) }
                              }));
                            }}>
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <IncentiveTable tiers={tiers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SalesAdmin;

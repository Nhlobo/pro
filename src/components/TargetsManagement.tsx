import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTargets } from '@/hooks/useTargets';
import { usePermissions } from '@/hooks/usePermissions';
import { Target, Edit, Trash2, Plus, TrendingUp, TrendingDown, Minus, Filter, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TargetsManagement = () => {
  const { targets, loading, createTarget, updateTarget, deleteTarget, spreadYearlyTarget } = useTargets();
  const { isAdmin } = usePermissions();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isYearlySpreadDialogOpen, setIsYearlySpreadDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [comparisonYear, setComparisonYear] = useState(new Date().getFullYear() - 1);
  const [filterPeriodType, setFilterPeriodType] = useState<'all' | 'monthly' | 'quarterly' | 'yearly'>('all');
  const [newTarget, setNewTarget] = useState({
    period_type: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    period_start: '',
    period_end: '',
    target_assessments: 0
  });
  const [yearlySpread, setYearlySpread] = useState({
    year: new Date().getFullYear(),
    yearly_target: 0
  });

  const handleCreateTarget = async () => {
    if (!isAdmin()) {
      toast.error('Only administrators can create targets');
      return;
    }

    if (!newTarget.period_start || !newTarget.period_end || newTarget.target_assessments <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const success = await createTarget(newTarget);
    if (success) {
      setIsCreateDialogOpen(false);
      setNewTarget({
        period_type: 'monthly',
        period_start: '',
        period_end: '',
        target_assessments: 0
      });
    }
  };

  const handleSpreadYearlyTarget = async () => {
    if (!isAdmin()) {
      toast.error('Only administrators can spread yearly targets');
      return;
    }

    if (yearlySpread.yearly_target <= 0) {
      toast.error('Please enter a valid yearly target');
      return;
    }

    const success = await spreadYearlyTarget(yearlySpread.yearly_target, yearlySpread.year);
    if (success) {
      setIsYearlySpreadDialogOpen(false);
      setYearlySpread({
        year: new Date().getFullYear(),
        yearly_target: 0
      });
      toast.success('Yearly target spread into monthly and quarterly targets');
    }
  };

  const handleUpdateTarget = async (targetId: string, newAssessments: number) => {
    if (!isAdmin()) {
      toast.error('Only administrators can edit targets');
      return;
    }

    const success = await updateTarget(targetId, { target_assessments: newAssessments });
    if (success) {
      setEditingTarget(null);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!isAdmin()) {
      toast.error('Only administrators can delete targets');
      return;
    }

    if (confirm('Are you sure you want to delete this target?')) {
      await deleteTarget(targetId);
    }
  };

  const getAchievementIcon = (isAchieved: boolean, percentage: number) => {
    if (isAchieved) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (percentage >= 75) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getAchievementColor = (isAchieved: boolean, percentage: number) => {
    if (isAchieved) return 'bg-green-100 text-green-800 border-green-200';
    if (percentage >= 75) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  // Filter and organize targets by year and type (exclude yearly targets from table)
  const filteredTargets = useMemo(() => {
    return targets.filter(target => {
      const targetYear = new Date(target.period_start).getFullYear();
      const matchesYear = targetYear === selectedYear;
      // Exclude yearly targets from table display
      const isNotYearly = target.period_type !== 'yearly';
      const matchesType = filterPeriodType === 'all' || target.period_type === filterPeriodType;
      return matchesYear && isNotYearly && matchesType;
    });
  }, [targets, selectedYear, filterPeriodType]);

  // Get comparison data for previous year (exclude yearly targets from comparison)
  const comparisonData = useMemo(() => {
    return targets.filter(target => {
      const targetYear = new Date(target.period_start).getFullYear();
      const matchesYear = targetYear === comparisonYear;
      // Exclude yearly targets from comparison data
      const isNotYearly = target.period_type !== 'yearly';
      const matchesType = filterPeriodType === 'all' || target.period_type === filterPeriodType;
      return matchesYear && isNotYearly && matchesType;
    });
  }, [targets, comparisonYear, filterPeriodType]);

  // Calculate summary statistics
  const currentYearStats = useMemo(() => {
    const monthlyTargets = filteredTargets.filter(t => t.period_type === 'monthly');
    const quarterlyTargets = filteredTargets.filter(t => t.period_type === 'quarterly');
    
    // Calculate yearly totals using multiplication
    const monthlyYearlyTarget = monthlyTargets.length > 0 ? monthlyTargets[0].target_assessments * 12 : 0;
    const quarterlyYearlyTarget = quarterlyTargets.length > 0 ? quarterlyTargets[0].target_assessments * 4 : 0;
    const totalTarget = monthlyYearlyTarget || quarterlyYearlyTarget || 0;
    
    const monthlyYearlyActual = monthlyTargets.reduce((sum, target) => sum + target.actual_assessments, 0);
    const quarterlyYearlyActual = quarterlyTargets.reduce((sum, target) => sum + target.actual_assessments, 0);
    const totalActual = monthlyYearlyActual + quarterlyYearlyActual;
    
    const achievedCount = filteredTargets.filter(target => target.is_achieved).length;
    return {
      totalTarget,
      totalActual,
      achievedCount,
      totalTargets: filteredTargets.length,
      achievementRate: filteredTargets.length > 0 ? Math.round((achievedCount / filteredTargets.length) * 100) : 0,
      overallPerformance: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0,
      breakdown: {
        monthlyTarget: monthlyYearlyTarget,
        quarterlyTarget: quarterlyYearlyTarget,
        monthlyActual: monthlyYearlyActual,
        quarterlyActual: quarterlyYearlyActual
      }
    };
  }, [filteredTargets]);

  const previousYearStats = useMemo(() => {
    const monthlyTargets = comparisonData.filter(t => t.period_type === 'monthly');
    const quarterlyTargets = comparisonData.filter(t => t.period_type === 'quarterly');
    
    // Calculate yearly totals using multiplication
    const monthlyYearlyTarget = monthlyTargets.length > 0 ? monthlyTargets[0].target_assessments * 12 : 0;
    const quarterlyYearlyTarget = quarterlyTargets.length > 0 ? quarterlyTargets[0].target_assessments * 4 : 0;
    const totalTarget = monthlyYearlyTarget || quarterlyYearlyTarget || 0;
    
    const monthlyYearlyActual = monthlyTargets.reduce((sum, target) => sum + target.actual_assessments, 0);
    const quarterlyYearlyActual = quarterlyTargets.reduce((sum, target) => sum + target.actual_assessments, 0);
    const totalActual = monthlyYearlyActual + quarterlyYearlyActual;
    
    const achievedCount = comparisonData.filter(target => target.is_achieved).length;
    return {
      totalTarget,
      totalActual,
      achievedCount,
      totalTargets: comparisonData.length,
      achievementRate: comparisonData.length > 0 ? Math.round((achievedCount / comparisonData.length) * 100) : 0,
      overallPerformance: totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
    };
  }, [comparisonData]);

  // Available years from the data
  const availableYears = useMemo(() => {
    const years = [...new Set(targets.map(target => new Date(target.period_start).getFullYear()))];
    return years.sort((a, b) => b - a);
  }, [targets]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-kutlwano-blue" />
              Targets Management
            </CardTitle>
            {isAdmin() && (
              <div className="flex gap-2">
                <Dialog open={isYearlySpreadDialogOpen} onOpenChange={setIsYearlySpreadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Spread Yearly Target
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Spread Yearly Target</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Input
                          id="year"
                          type="number"
                          value={yearlySpread.year}
                          onChange={(e) => setYearlySpread(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="yearly_target">Yearly Target (Assessments)</Label>
                        <Input
                          id="yearly_target"
                          type="number"
                          value={yearlySpread.yearly_target}
                          onChange={(e) => setYearlySpread(prev => ({ ...prev, yearly_target: parseInt(e.target.value) }))}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        This will create monthly ({Math.ceil(yearlySpread.yearly_target / 12)} each) and quarterly ({Math.ceil(yearlySpread.yearly_target / 4)} each) targets automatically.
                      </div>
                      <Button onClick={handleSpreadYearlyTarget} className="w-full">
                        Create Targets
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Target
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Target</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="period_type">Period Type</Label>
                        <Select
                          value={newTarget.period_type}
                          onValueChange={(value) => setNewTarget(prev => ({ ...prev, period_type: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="period_start">Start Date</Label>
                          <Input
                            id="period_start"
                            type="date"
                            value={newTarget.period_start}
                            onChange={(e) => setNewTarget(prev => ({ ...prev, period_start: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="period_end">End Date</Label>
                          <Input
                            id="period_end"
                            type="date"
                            value={newTarget.period_end}
                            onChange={(e) => setNewTarget(prev => ({ ...prev, period_end: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="target_assessments">Target Assessments</Label>
                        <Input
                          id="target_assessments"
                          type="number"
                          value={newTarget.target_assessments}
                          onChange={(e) => setNewTarget(prev => ({ ...prev, target_assessments: parseInt(e.target.value) }))}
                        />
                      </div>
                      <Button onClick={handleCreateTarget} className="w-full">
                        Create Target
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="year-select">Year:</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="type-filter">Type:</Label>
              <Select value={filterPeriodType} onValueChange={(value) => setFilterPeriodType(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="comparison-year">Compare with:</Label>
              <Select value={comparisonYear.toString()} onValueChange={(value) => setComparisonYear(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Year-over-Year Comparison Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{selectedYear} Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Yearly Target:</span>
                  <span className="font-medium">{currentYearStats.totalTarget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Actual Assessments:</span>
                  <span className="font-medium">{currentYearStats.totalActual}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Periods Achieved:</span>
                  <span className="font-medium">{currentYearStats.achievedCount}/{currentYearStats.totalTargets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Overall Performance:</span>
                  <span className={`font-medium ${currentYearStats.overallPerformance >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentYearStats.overallPerformance}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{comparisonYear} Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Yearly Target:</span>
                  <span className="font-medium">{previousYearStats.totalTarget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Actual Assessments:</span>
                  <span className="font-medium">{previousYearStats.totalActual}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Periods Achieved:</span>
                  <span className="font-medium">{previousYearStats.achievedCount}/{previousYearStats.totalTargets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Overall Performance:</span>
                  <span className={`font-medium ${previousYearStats.overallPerformance >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {previousYearStats.overallPerformance}%
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">vs {selectedYear}:</span>
                    <span className={`font-medium ${currentYearStats.overallPerformance > previousYearStats.overallPerformance ? 'text-green-600' : 'text-red-600'}`}>
                      {currentYearStats.overallPerformance > previousYearStats.overallPerformance ? '+' : ''}
                      {(currentYearStats.overallPerformance - previousYearStats.overallPerformance).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No targets found for the selected year and type. Create your first target to start tracking performance.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Difference</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin() && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.map((target) => (
                    <TableRow key={target.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {format(new Date(target.period_start), 'dd/MM/yyyy')} - {format(new Date(target.period_end), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {target.period_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {editingTarget === target.id && isAdmin() ? (
                          <Input
                            type="number"
                            defaultValue={target.target_assessments}
                            className="w-20"
                            onBlur={(e) => handleUpdateTarget(target.id, parseInt(e.target.value))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateTarget(target.id, parseInt((e.target as HTMLInputElement).value));
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{target.target_assessments}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{target.actual_assessments}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${target.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {target.difference >= 0 ? '+' : ''}{target.difference}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAchievementIcon(target.is_achieved, target.achievement_percentage)}
                          <span className="font-medium">{target.achievement_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getAchievementColor(target.is_achieved, target.achievement_percentage)}>
                          {target.is_achieved ? 'Achieved' : target.achievement_percentage >= 75 ? 'On Track' : 'Behind'}
                        </Badge>
                      </TableCell>
                      {isAdmin() && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingTarget(target.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTarget(target.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TargetsManagement;
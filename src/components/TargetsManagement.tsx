import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTargets } from '@/hooks/useTargets';
import { Target, Edit, Trash2, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';

const TargetsManagement = () => {
  const { targets, loading, createTarget, updateTarget, deleteTarget, spreadYearlyTarget } = useTargets();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isYearlySpreadDialogOpen, setIsYearlySpreadDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
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
    const success = await updateTarget(targetId, { target_assessments: newAssessments });
    if (success) {
      setEditingTarget(null);
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-kutlwano-blue" />
            Targets Management
          </CardTitle>
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
        </div>
      </CardHeader>
      <CardContent>
        {targets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No targets set yet. Create your first target to start tracking performance.</p>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {target.period_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {editingTarget === target.id ? (
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
                          onClick={() => deleteTarget(target.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TargetsManagement;
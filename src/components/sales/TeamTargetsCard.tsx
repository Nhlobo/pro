import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Users, Pencil, Check, X, CalendarDays, CalendarRange, Calendar } from 'lucide-react';
import { useTeamTargets } from '@/hooks/useTeamTargets';
import { SalesConsultant, MonthlyPerformance } from '@/hooks/useSalesIncentives';
import { toast } from 'sonner';

interface TeamTargetsCardProps {
  consultants: SalesConsultant[];
  allPerformance: MonthlyPerformance[];
  isAdmin?: boolean;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TeamTargetsCard: React.FC<TeamTargetsCardProps> = ({ consultants, allPerformance, isAdmin = false }) => {
  const {
    currentMonth,
    currentYear,
    currentQuarter,
    getCurrentTarget,
    upsertTarget,
  } = useTeamTargets();

  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeConsultants = consultants.filter(c => c.is_active);
  const teamSize = activeConsultants.length || 1;

  // Current month total appointments across all consultants
  const totalTeamAppts = allPerformance.reduce((sum, p) => sum + (p.total_appts || 0), 0);

  const startEdit = (type: string, currentVal: number) => {
    setEditingType(type);
    setEditValue(String(currentVal));
  };

  const cancelEdit = () => {
    setEditingType(null);
    setEditValue('');
  };

  const saveTarget = async (periodType: 'monthly' | 'quarterly' | 'yearly') => {
    const val = parseInt(editValue);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid target number');
      return;
    }

    const opts: any = {};
    if (periodType === 'monthly') opts.month = currentMonth;
    if (periodType === 'quarterly') opts.quarter = currentQuarter;

    const { error } = await upsertTarget(periodType, val, opts);
    if (error) {
      toast.error('Failed to save target');
    } else {
      toast.success(`${periodType.charAt(0).toUpperCase() + periodType.slice(1)} target updated`);
      cancelEdit();
    }
  };

  const monthlyTarget = getCurrentTarget('monthly');
  const quarterlyTarget = getCurrentTarget('quarterly');
  const yearlyTarget = getCurrentTarget('yearly');

  const renderTargetCard = (
    label: string,
    periodType: 'monthly' | 'quarterly' | 'yearly',
    target: ReturnType<typeof getCurrentTarget>,
    icon: React.ReactNode,
    periodLabel: string,
    teamAppts: number,
  ) => {
    const teamVal = target?.team_target || 0;
    const perPerson = teamSize > 0 ? Math.ceil(teamVal / teamSize) : 0;
    const progress = teamVal > 0 ? Math.min(100, (teamAppts / teamVal) * 100) : 0;
    const isEditing = editingType === periodType;

    return (
      <div className="p-4 rounded-lg border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
            </div>
          </div>
          {isAdmin && !isEditing && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(periodType, teamVal)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="h-8 text-sm"
              placeholder="Team target"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => saveTarget(periodType)}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Team Target</p>
                <p className="text-xl font-bold text-foreground">{teamVal || '—'}</p>
              </div>
              <div className="p-2 rounded-md bg-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Per Person</p>
                <p className="text-xl font-bold text-primary">{teamVal ? perPerson : '—'}</p>
              </div>
            </div>

            {teamVal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Progress: {teamAppts} / {teamVal}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </>
        )}

        {teamVal > 0 && !isEditing && (
          <div className="flex flex-wrap gap-1.5">
            {activeConsultants.map(c => {
              const cPerf = allPerformance.find(p => p.consultant_id === c.id);
              const cAppts = cPerf?.total_appts || 0;
              const met = cAppts >= perPerson;
              return (
                <Badge
                  key={c.id}
                  variant={met ? 'default' : 'outline'}
                  className={`text-[9px] ${!met ? 'border-destructive/50 text-destructive' : ''}`}
                >
                  {c.name.split(' ')[0]}: {cAppts}/{perPerson}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const quarterMonths = [(currentQuarter - 1) * 3 + 1, (currentQuarter - 1) * 3 + 2, (currentQuarter - 1) * 3 + 3];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Team Targets
          <Badge variant="outline" className="text-[10px] ml-auto">
            <Users className="h-3 w-3 mr-1" />
            {teamSize} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly" className="text-xs">Quarterly</TabsTrigger>
            <TabsTrigger value="yearly" className="text-xs">Yearly</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly">
            {renderTargetCard(
              'Monthly Target',
              'monthly',
              monthlyTarget,
              <CalendarDays className="h-5 w-5 text-primary" />,
              `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`,
              totalTeamAppts,
            )}
          </TabsContent>

          <TabsContent value="quarterly">
            {renderTargetCard(
              'Quarterly Target',
              'quarterly',
              quarterlyTarget,
              <CalendarRange className="h-5 w-5 text-primary" />,
              `Q${currentQuarter} ${currentYear} (${MONTH_NAMES[quarterMonths[0] - 1]}–${MONTH_NAMES[quarterMonths[2] - 1]})`,
              totalTeamAppts, // simplified: uses current month data
            )}
          </TabsContent>

          <TabsContent value="yearly">
            {renderTargetCard(
              'Yearly Target',
              'yearly',
              yearlyTarget,
              <Calendar className="h-5 w-5 text-primary" />,
              `${currentYear}`,
              totalTeamAppts, // simplified: uses current month data
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TeamTargetsCard;

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, ArrowLeftRight, Calendar, CreditCard, FileText, Clock } from 'lucide-react';
import type { TrialCase, FirmRole, RoleColors } from './trialPrepData';
import { DEMO_CASES, getRoleColors } from './trialPrepData';
import TrialPrepDetail from './TrialPrepDetail';

interface TrialPrepDashboardProps {
  /** Live cases from the CaseAccess page — will be used to generate trial cases in the future */
  liveCases?: Array<{
    id: string;
    claimant_name: string;
    expert_type: string;
    appointment_date: string;
    case_status: string;
  }>;
}

const TrialPrepDashboard: React.FC<TrialPrepDashboardProps> = ({ liveCases }) => {
  const [role, setRole] = useState<FirmRole>('PLAINTIFF');
  const [selectedCase, setSelectedCase] = useState<TrialCase | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const rc = getRoleColors(role);
  const cases = DEMO_CASES;
  const filtered = filterType === 'all' ? cases : cases.filter(c => c.caseType === filterType);

  if (selectedCase) {
    return <TrialPrepDetail caseData={selectedCase} role={role} rc={rc} onBack={() => setSelectedCase(null)} />;
  }

  const getPriorityBadge = (p: string) => {
    if (p === 'CRITICAL') return <Badge variant="destructive">{p}</Badge>;
    if (p === 'HIGH') return <Badge className="bg-warning text-warning-foreground">{p}</Badge>;
    return <Badge variant="secondary">{p}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Role Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-lg text-primary-foreground">{rc.icon}</div>
              <div>
                <p className="text-sm font-bold text-primary">Acting as: {rc.label}</p>
                <p className="text-xs text-muted-foreground">
                  {role === 'PLAINTIFF' ? "All checklists, documents and AI strategy configured for the plaintiff's case." : "All checklists, documents and AI strategy configured to defend against the plaintiff's claim."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRole(r => r === 'PLAINTIFF' ? 'DEFENDANT' : 'PLAINTIFF'); setSelectedCase(null); }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
              Switch to {role === 'PLAINTIFF' ? 'Defendant' : 'Plaintiff'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Calendar className="h-5 w-5 text-primary" />, label: 'Total Cases', value: cases.length },
          { icon: <CreditCard className="h-5 w-5 text-secondary" />, label: 'Paid', value: cases.filter(c => c.payment === 'paid').length },
          { icon: <FileText className="h-5 w-5 text-warning" />, label: 'Reports Delivered', value: cases.filter(c => c.report === 'Delivered').length },
          { icon: <Clock className="h-5 w-5 text-muted-foreground" />, label: 'Pending Payment', value: cases.filter(c => c.payment === 'deposit').length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-4 text-center">
              <div className="flex justify-center mb-1">{s.icon}</div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cases Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Trial Prep — Case Details · <span className="text-primary">{rc.label}</span>
            </CardTitle>
            <div className="flex gap-2">
              {['all', 'RAF', 'Medical Negligence'].map(f => (
                <Button
                  key={f}
                  variant={filterType === f ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setFilterType(f)}
                >
                  {f === 'all' ? 'All' : f === 'RAF' ? '🚗 MVA/RAF' : '🏥 Med Neg'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {(role === 'PLAINTIFF'
                    ? ['Claimant', 'Defendant', 'Expert Type', 'Date', 'Matter', 'Status', 'Payment', 'Report', 'Trial Date', 'Priority', 'Actions']
                    : ['Defendant', 'Claimant', 'Expert Type', 'Date', 'Matter', 'Status', 'Payment', 'Report', 'Trial Date', 'Priority', 'Actions']
                  ).map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedCase(c)}>
                    <TableCell className="font-bold text-xs">
                      {role === 'PLAINTIFF' ? c.claimant : c.defendant}
                      <p className="text-[10px] text-muted-foreground font-normal">{c.fileRef}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{role === 'PLAINTIFF' ? c.defendant : c.claimant}</TableCell>
                    <TableCell className="text-xs text-primary font-semibold">{c.expertType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.date}</TableCell>
                    <TableCell>
                      <Badge variant={c.caseType === 'RAF' ? 'secondary' : 'outline'} className="text-[10px]">
                        {c.caseType === 'RAF' ? '🚗 MVA/RAF' : '🏥 Med Neg'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.caseStatus === 'trial-prep' ? <Badge variant="default" className="text-[10px] bg-primary">⚖ Trial Prep</Badge>
                        : c.caseStatus === 'scheduled' ? <Badge variant="secondary" className="text-[10px]">● Scheduled</Badge>
                        : <Badge variant="outline" className="text-[10px]">⏳ Pending</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.payment === 'paid' ? 'default' : 'outline'} className={`text-[10px] ${c.payment === 'paid' ? 'bg-secondary text-secondary-foreground' : ''}`}>
                        {c.payment === 'paid' ? '✓ Paid' : '⊙ Deposit'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.report === 'Delivered' ? 'default' : 'outline'} className={`text-[10px] ${c.report === 'Delivered' ? 'bg-secondary text-secondary-foreground' : ''}`}>
                        {c.report === 'Delivered' ? '✓ Delivered' : '⏱ Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{c.trialDate}</TableCell>
                    <TableCell>{getPriorityBadge(c.priority)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="default" className="text-[11px] h-7" onClick={() => setSelectedCase(c)}>
                        <Scale className="h-3 w-3 mr-1" /> Trial Prep
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialPrepDashboard;

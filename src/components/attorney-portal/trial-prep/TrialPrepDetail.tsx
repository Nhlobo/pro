import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Scale, FileText, Users, CheckSquare, BookOpen, Brain, AlertTriangle, CheckCircle2, Clock, Flame } from 'lucide-react';
import type { TrialCase, FirmRole, RoleColors, AnalysisResult } from './trialPrepData';
import { EXPERT_TYPES, EXPERT_IMPORTANCE, CHECKLISTS, DOCUMENTS, ANALYSIS, getLegalNotes } from './trialPrepData';

interface TrialPrepDetailProps {
  caseData: TrialCase;
  role: FirmRole;
  rc: RoleColors;
  onBack: () => void;
}

const TrialPrepDetail: React.FC<TrialPrepDetailProps> = ({ caseData, role, rc, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const isRAF = caseData.caseType === 'RAF';
  const analysis = ANALYSIS[caseData.id]?.[role];
  const saChecklist = CHECKLISTS[role][isRAF ? 'RAF' : 'Medical Negligence'];
  const done = saChecklist.filter(([k]) => checklist[k]).length;
  const pct = Math.round((done / saChecklist.length) * 100);
  const expertTypesNeeded = EXPERT_TYPES[role][isRAF ? 'RAF' : 'Medical Negligence'];
  const docs = DOCUMENTS[role][isRAF ? 'RAF' : 'Medical Negligence'];
  const importanceList = EXPERT_IMPORTANCE[role];
  const legalNotes = getLegalNotes(role, isRAF);

  const toggle = (k: string) => setChecklist(p => ({ ...p, [k]: !p[k] }));

  const timeline = [
    { date: caseData.accidentDate, event: isRAF ? `MVA — ${caseData.description.split('.')[0]}` : `Incident — ${caseData.description.split('.')[0]}`, type: 'incident', critical: true },
    ...caseData.milestones.map((m, i) => ({
      date: m.date,
      event: m.label + (m.done ? ' ✓' : ' — Upcoming'),
      type: i === 0 ? 'legal' : i <= 2 ? 'expert' : 'trial',
      critical: i >= 2,
    })),
  ].filter(e => e.date);

  const getPriorityColor = (p: string) => {
    if (p === 'CRITICAL') return 'text-destructive';
    if (p === 'HIGH') return 'text-warning';
    return 'text-primary';
  };

  const getStatusBadge = (s: string) => {
    if (s === 'trial-prep') return <Badge variant="default" className="bg-primary">⚖ Trial Prep</Badge>;
    if (s === 'scheduled') return <Badge variant="secondary">● Scheduled</Badge>;
    return <Badge variant="outline">⏳ Pending</Badge>;
  };

  const getImpBadge = (imp: string) => {
    if (imp === 'CRITICAL') return <Badge variant="destructive">{imp}</Badge>;
    if (imp === 'HIGH') return <Badge className="bg-warning text-warning-foreground">{imp}</Badge>;
    return <Badge variant="secondary">{imp}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">{role === 'PLAINTIFF' ? caseData.claimant : caseData.defendant}</span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="font-medium text-muted-foreground">{role === 'PLAINTIFF' ? caseData.defendant : caseData.claimant}</span>
                <Badge variant={caseData.caseType === 'RAF' ? 'secondary' : 'outline'}>{caseData.caseType === 'RAF' ? '🚗 MVA/RAF' : '🏥 Med Neg'}</Badge>
                {getStatusBadge(caseData.caseStatus)}
                <Badge className={getPriorityColor(caseData.priority)} variant="outline">{caseData.priority}</Badge>
                <Badge variant="outline">{rc.icon} {rc.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{caseData.id} · {caseData.fileRef} · {caseData.court}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">Trial Date</p>
              <p className={`font-mono font-bold ${caseData.daysToTrial < 90 ? 'text-destructive' : 'text-warning'}`}>
                {caseData.trialDate} · {caseData.daysToTrial}d
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="experts">{role === 'PLAINTIFF' ? 'Expert Witnesses' : 'Defence Experts'}</TabsTrigger>
          <TabsTrigger value="checklist">SA Checklist</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ['Our Client', role === 'PLAINTIFF' ? caseData.claimant : caseData.defendant],
                  ['Opposing Party', role === 'PLAINTIFF' ? caseData.defendant : caseData.claimant],
                  ['Role', rc.label],
                  ['Matter Type', caseData.caseType],
                  ['Court', caseData.court],
                  ['Governing Act', caseData.actNo],
                  ['Trial Date', caseData.trialDate],
                  ['Days to Trial', `${caseData.daysToTrial} days`],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{l}</p>
                    <p className="text-sm font-bold text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">📋 Case Description</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{caseData.description}</p></CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">🔖 Case Milestones</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start overflow-x-auto pb-2">
                {caseData.milestones.map((m, i) => (
                  <div key={i} className="flex items-center">
                    <div className="text-center min-w-[90px]">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1 text-xs font-bold ${m.done ? 'bg-primary text-primary-foreground' : 'bg-muted border-2 border-border text-muted-foreground'}`}>
                        {m.done ? '✓' : i + 1}
                      </div>
                      <p className={`text-[10px] leading-tight ${m.done ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{m.label}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{m.date}</p>
                    </div>
                    {i < caseData.milestones.length - 1 && <div className={`w-8 h-0.5 mb-6 shrink-0 ${m.done ? 'bg-primary' : 'bg-border'}`} />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Documents on file */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">📁 Documents on File ({caseData.documents.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {caseData.documents.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">📄 {d}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">📅 Medico-Legal Timeline — {isRAF ? 'RAF Act 56/1996' : 'NHA 61/2003'} · {rc.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-8 space-y-3">
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/60 to-border/40" />
                {timeline.map((e, i) => (
                  <div key={i} className="relative flex gap-3 items-start">
                    <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 border-background ${e.critical ? 'bg-destructive' : 'bg-border'}`} style={{ top: '4px' }} />
                    <span className="font-mono text-[10px] text-muted-foreground min-w-[80px] pt-0.5">{e.date}</span>
                    <div className={`flex-1 p-2.5 rounded-lg bg-muted/30 border ${e.critical ? 'border-destructive/20' : 'border-border/50'}`}>
                      <div className="flex gap-1.5 mb-1">
                        <Badge variant="outline" className="text-[10px] h-4">{e.type.toUpperCase()}</Badge>
                        {e.critical && <Badge variant="destructive" className="text-[10px] h-4">⚠ KEY EVENT</Badge>}
                      </div>
                      <p className="text-xs text-foreground">{e.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPERTS */}
        <TabsContent value="experts" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{role === 'PLAINTIFF' ? '👨‍⚕️ Plaintiff Expert Types Required' : '🛡️ Defence Expert Types Required'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {expertTypesNeeded.map(t => (
                  <div key={t} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border/50">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span className="text-xs font-semibold">{t}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">⭐ {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defence'} Expert Importance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {importanceList.map(e => (
                  <div key={e.type} className={`p-3 bg-muted/20 rounded-lg border ${e.imp === 'CRITICAL' ? 'border-destructive/30' : e.imp === 'HIGH' ? 'border-warning/30' : 'border-border/50'}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-xs font-bold">{e.icon} {e.type}</span>
                      {getImpBadge(e.imp)}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{e.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHECKLIST */}
        <TabsContent value="checklist">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">✅ {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defendant'} Trial Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-bold">{done} of {saChecklist.length} tasks complete</span>
                    <span className={`text-xs font-bold ${pct === 100 ? 'text-secondary' : pct > 60 ? 'text-warning' : 'text-destructive'}`}>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1.5 pr-2">
                    {saChecklist.map(([k, label]) => (
                      <div
                        key={k}
                        onClick={() => toggle(k)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${checklist[k] ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20 border border-border/50 hover:bg-muted/40'}`}
                      >
                        <Checkbox checked={!!checklist[k]} className="pointer-events-none" />
                        <span className={`text-xs ${checklist[k] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">⚖ SA Legal Framework — {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defendant'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {legalNotes.map((n, i) => (
                  <div key={i} className="p-3 bg-muted/20 rounded-lg border border-border/50">
                    <p className="text-[11px] font-bold text-primary mb-1">{n.h}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{n.b}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">📁 {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defence'} Document Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {docs.map(doc => (
                  <div key={doc.label} className="p-3 bg-muted/20 rounded-lg border border-border/50">
                    <p className="text-xs font-bold mb-1">{doc.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{doc.desc}</p>
                    <Button variant="outline" size="sm" className="text-xs">Generate →</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI ANALYSIS */}
        <TabsContent value="analysis">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🤖 AI {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defence'} Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-xs text-muted-foreground">
                  <p className="font-bold text-primary text-[10px] uppercase mb-1">{rc.icon} Case Loaded — {rc.label}</p>
                  <strong className="text-foreground">{role === 'PLAINTIFF' ? caseData.claimant : caseData.defendant}</strong> · {caseData.id}
                </div>
                <Button
                  className="w-full"
                  disabled={analysing || !analysis}
                  onClick={() => {
                    if (!analysis) return;
                    setAnalysing(true);
                    setTimeout(() => { setResult(analysis); setAnalysing(false); }, 1800);
                  }}
                >
                  {analysing ? '🤖 Analysing case...' : `🤖 Run AI ${role === 'PLAINTIFF' ? 'Plaintiff' : 'Defence'} Strategy Analysis`}
                </Button>
                {analysing && <Progress value={100} className="h-1 animate-pulse" />}
              </CardContent>
            </Card>

            <div className="md:col-span-2 space-y-4">
              {!result && !analysing && (
                <Card className="text-center py-12">
                  <CardContent>
                    <p className="text-4xl mb-3">{rc.icon}</p>
                    <p className="text-sm text-muted-foreground">Click the analysis button to receive AI-powered {role === 'PLAINTIFF' ? 'plaintiff' : 'defence'} strategy advice.</p>
                  </CardContent>
                </Card>
              )}

              {result && !analysing && (
                <>
                  {/* Outcome */}
                  <Card className={`border-l-4 ${result.outcome.confidence >= 75 ? 'border-l-secondary' : 'border-l-warning'}`}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">🤖 AI Outcome Prediction</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-3 bg-muted/30 rounded-lg text-center">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Predicted Outcome</p>
                          <p className="text-sm font-bold text-foreground">{result.outcome.verdict}</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg text-center">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Confidence</p>
                          <p className={`text-2xl font-bold ${result.outcome.confidence >= 75 ? 'text-secondary' : 'text-warning'}`}>{result.outcome.confidence}%</p>
                          <Progress value={result.outcome.confidence} className="h-1 mt-1" />
                        </div>
                      </div>
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-[10px] font-bold text-primary uppercase mb-1">⚖ Strategic Recommendation</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{result.outcome.strategy}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Key findings */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">📋 {role === 'PLAINTIFF' ? 'Key Findings' : 'Key Intelligence'}</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {result.keyFindings.map((f, i) => (
                        <div key={i} className="flex gap-2 py-1.5 border-b border-border/30 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{f}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Risk factors */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{role === 'PLAINTIFF' ? '⚠ Risk Factors' : '⚠ Vulnerabilities & Opportunities'}</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {result.riskFactors.map((r, i) => (
                        <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/15 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{r}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Legal points */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{isRAF ? '🚗 RAF Legal Analysis' : '🏥 Med Neg Legal Analysis'} — {role === 'PLAINTIFF' ? 'Plaintiff' : 'Defence'}</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {Object.entries(result.legalPoints).filter(([k]) => k !== 'type').map(([k, v]) => (
                        <div key={k} className="flex gap-3 py-1.5 border-b border-border/30 text-xs">
                          <span className="text-muted-foreground min-w-[100px] text-[10px] uppercase font-bold tracking-wider pt-0.5">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-muted-foreground">{v}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrialPrepDetail;

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Stethoscope, 
  Calendar,
  Scale,
  UserCheck,
  AlertCircle
} from "lucide-react";

interface NegligenceIndicator {
  category: string;
  finding: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
  recordReference?: string;
  dateOfEvent?: string | null;
  standardOfCareViolated?: string;
}

interface TimelineEvent {
  date: string;
  documentType: string;
  event: string;
  significance: string;
  linkedNegligence: string | null;
}

interface ExpertRecommendation {
  expertType: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  linkedNegligenceTypes?: string[];
  specificReviewAreas?: string[];
}

interface NegligenceAnalysisResultsProps {
  result: {
    meritOpinion?: {
      opinion: 'possible_negligence' | 'no_clear_negligence';
      confidence: 'low' | 'medium' | 'high';
      summary: string;
      keyFactors?: string[];
    };
    overallSeverity: string;
    documentTypesIdentified?: string[];
    medicalTimeline?: TimelineEvent[];
    negligenceIndicators: NegligenceIndicator[];
    negligenceByType?: Record<string, NegligenceIndicator[]>;
    keyEvidence: any[];
    expertRecommendations: ExpertRecommendation[];
    factsSummary?: string;
  };
}

const NEGLIGENCE_TYPE_LABELS: Record<string, string> = {
  delayed_diagnosis: "Delayed Diagnosis",
  failure_to_diagnose: "Failure to Diagnose",
  incorrect_diagnosis: "Incorrect Diagnosis",
  surgical_negligence: "Surgical Negligence",
  anaesthetic_negligence: "Anaesthetic Negligence",
  medication_error: "Medication Error",
  failure_to_monitor: "Failure to Monitor Patient",
  failure_to_refer: "Failure to Refer or Escalate",
  poor_post_operative_care: "Poor Post-Operative Care",
  birth_related_negligence: "Birth-Related Negligence",
  nursing_negligence: "Nursing Negligence",
  system_hospital_negligence: "System / Hospital Negligence"
};

const DOCUMENT_TYPE_ICONS: Record<string, string> = {
  clinical_notes: "📋",
  nursing_notes: "👩‍⚕️",
  operation_report: "🔪",
  medication_chart: "💊",
  referral_letter: "📨",
  discharge_summary: "🏥",
  radiology_report: "📷",
  pathology_report: "🔬"
};

export const NegligenceAnalysisResults: React.FC<NegligenceAnalysisResultsProps> = ({ result }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Merit Opinion Banner */}
      {result.meritOpinion && (
        <Card className={`border-2 ${
          result.meritOpinion.opinion === 'possible_negligence' 
            ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
            : 'border-green-500 bg-green-50 dark:bg-green-950/20'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {result.meritOpinion.opinion === 'possible_negligence' ? (
                <AlertTriangle className="h-10 w-10 text-red-600 shrink-0" />
              ) : (
                <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">
                  {result.meritOpinion.opinion === 'possible_negligence' 
                    ? '⚠️ POSSIBLE NEGLIGENCE IDENTIFIED'
                    : '✓ NO CLEAR NEGLIGENCE IDENTIFIED AT THIS STAGE'}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">{result.meritOpinion.summary}</p>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    Confidence: {result.meritOpinion.confidence.toUpperCase()}
                  </Badge>
                  <Badge variant={getSeverityColor(result.overallSeverity)}>
                    Severity: {result.overallSeverity.toUpperCase()}
                  </Badge>
                </div>
                {result.meritOpinion.keyFactors && result.meritOpinion.keyFactors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Key Factors:</p>
                    <ul className="text-sm space-y-1">
                      {result.meritOpinion.keyFactors.slice(0, 5).map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This is a preliminary medico-legal screening opinion only, not a final expert opinion.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Types Identified */}
      {result.documentTypesIdentified && result.documentTypesIdentified.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Medical Records Identified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.documentTypesIdentified.map((docType, idx) => (
                <Badge key={idx} variant="outline" className="text-sm py-1">
                  {DOCUMENT_TYPE_ICONS[docType] || "📄"} {docType.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Analysis Tabs */}
      <Tabs defaultValue="negligence" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="negligence" className="gap-1">
            <Scale className="h-4 w-4" />
            Negligence ({result.negligenceIndicators.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1">
            <Calendar className="h-4 w-4" />
            Timeline ({result.medicalTimeline?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1">
            <FileText className="h-4 w-4" />
            Evidence ({result.keyEvidence.length})
          </TabsTrigger>
          <TabsTrigger value="experts" className="gap-1">
            <Stethoscope className="h-4 w-4" />
            Experts ({result.expertRecommendations.length})
          </TabsTrigger>
        </TabsList>

        {/* Negligence Types Tab */}
        <TabsContent value="negligence" className="mt-4">
          {result.negligenceByType && Object.keys(result.negligenceByType).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(result.negligenceByType).map(([type, indicators]) => (
                <Card key={type} className="border-l-4 border-l-red-500">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      {NEGLIGENCE_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                      <Badge variant="destructive" className="ml-auto">{indicators.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {indicators.map((indicator, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-sm">{indicator.finding}</p>
                            <Badge variant={getSeverityColor(indicator.severity)}>
                              {indicator.severity}
                            </Badge>
                          </div>
                          <div className="grid gap-2 text-xs text-muted-foreground">
                            {indicator.evidence && (
                              <p><strong>Evidence:</strong> {indicator.evidence}</p>
                            )}
                            {indicator.recordReference && (
                              <p><strong>Record Reference:</strong> {indicator.recordReference}</p>
                            )}
                            {indicator.dateOfEvent && (
                              <p><strong>Date:</strong> {indicator.dateOfEvent}</p>
                            )}
                            {indicator.standardOfCareViolated && (
                              <p><strong>Standard Violated:</strong> {indicator.standardOfCareViolated}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>No clear negligence indicators identified in the reviewed records.</p>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Chronological Medical Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {result.medicalTimeline && result.medicalTimeline.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-muted space-y-4">
                    {result.medicalTimeline.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className={`absolute -left-[25px] w-4 h-4 rounded-full border-2 ${
                          event.linkedNegligence 
                            ? 'bg-red-500 border-red-600' 
                            : 'bg-background border-muted-foreground'
                        }`} />
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {event.date || 'Unknown date'}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {event.documentType?.replace(/_/g, ' ') || 'Record'}
                            </Badge>
                            {event.linkedNegligence && (
                              <Badge variant="destructive" className="text-xs">
                                ⚠️ Linked to negligence
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium">{event.event}</p>
                          <p className="text-xs text-muted-foreground mt-1">{event.significance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No timeline events extracted from the records.
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {result.keyEvidence.length > 0 ? (
                    result.keyEvidence.map((evidence, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{evidence.type}</Badge>
                          {evidence.date && (
                            <span className="text-xs text-muted-foreground">{evidence.date}</span>
                          )}
                          {evidence.documentSource && (
                            <Badge variant="secondary" className="text-xs ml-auto">
                              {evidence.documentSource.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{evidence.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <strong>Relevance:</strong> {evidence.relevance}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No key evidence items extracted.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experts Tab */}
        <TabsContent value="experts" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Recommended Expert Referrals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.expertRecommendations.length > 0 ? (
                <div className="space-y-3">
                  {result.expertRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{rec.expertType}</span>
                        </div>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : 'default'}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>
                      
                      {rec.linkedNegligenceTypes && rec.linkedNegligenceTypes.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold mb-1">Linked to Negligence Issues:</p>
                          <div className="flex flex-wrap gap-1">
                            {rec.linkedNegligenceTypes.map((type, tIdx) => (
                              <Badge key={tIdx} variant="outline" className="text-xs">
                                {NEGLIGENCE_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {rec.specificReviewAreas && rec.specificReviewAreas.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Specific Review Areas:</p>
                          <ul className="text-xs text-muted-foreground">
                            {rec.specificReviewAreas.map((area, aIdx) => (
                              <li key={aIdx}>• {area}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No expert referrals recommended at this stage.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Facts Summary */}
      {result.factsSummary && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Summary of Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{result.factsSummary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

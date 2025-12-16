import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  Stethoscope,
  Scale,
  AlertCircle,
  Calendar,
  MapPin,
  Building,
  ScanLine,
  FileWarning
} from "lucide-react";

interface CaseScreeningResultsProps {
  result: any;
}

const CaseScreeningResults = ({ result }: CaseScreeningResultsProps) => {
  const getViabilityColor = (recommendation: string) => {
    switch (recommendation) {
      case 'take': return 'bg-green-100 text-green-800 border-green-200';
      case 'caution': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'do_not_take': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getViabilityIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'take': return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'caution': return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'do_not_take': return <XCircle className="h-6 w-6 text-red-600" />;
      default: return <AlertCircle className="h-6 w-6" />;
    }
  };

  const getViabilityText = (recommendation: string) => {
    switch (recommendation) {
      case 'take': return 'Recommended to Take Case';
      case 'caution': return 'Proceed with Caution';
      case 'do_not_take': return 'Not Recommended to Take';
      default: return 'Assessment Pending';
    }
  };

  const getPrescriptionColor = (status: string) => {
    switch (status) {
      case 'within_period': return 'bg-green-100 text-green-800';
      case 'approaching': return 'bg-yellow-100 text-yellow-800';
      case 'likely_expired': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCaseTypeLabel = (type: string) => {
    switch (type) {
      case 'road_accident': return 'Road Accident (RAF)';
      case 'slip_and_fall': return 'Slip and Fall';
      case 'unlawful_arrest': return 'Unlawful Arrest/Detention';
      default: return type;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'severe': return 'bg-orange-100 text-orange-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'minor': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Viability Banner */}
      <Card className={`border-2 ${getViabilityColor(result.viability?.recommendation)}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {getViabilityIcon(result.viability?.recommendation)}
            <div className="flex-1">
              <h3 className="text-xl font-bold">
                {getViabilityText(result.viability?.recommendation)}
              </h3>
              <p className="text-sm opacity-80">
                Confidence: {result.viability?.confidence || 0}%
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-sm">
                Initial Screening Opinion
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attorney Conflict Alert */}
      {result.attorneyConflict?.hasConflict && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attorney Conflict Detected</AlertTitle>
          <AlertDescription>
            {result.attorneyConflict.conflictDetails}
            {result.attorneyConflict.existingAttorney && (
              <span className="block mt-1 font-medium">
                Already assigned to: {result.attorneyConflict.existingAttorney}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Prescription Status Alert */}
      {result.prescriptionStatus?.urgentAction && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertTitle>Urgent: Prescription Deadline</AlertTitle>
          <AlertDescription>
            {result.prescriptionStatus.details}
          </AlertDescription>
        </Alert>
      )}

      {/* OCR Processing Info */}
      {result.ocrInfo && (result.ocrInfo.filesProcessedWithOCR?.length > 0 || result.ocrInfo.warnings?.length > 0) && (
        <Alert variant={result.ocrInfo.totalUnreadablePages > 0 ? "destructive" : "default"}>
          <ScanLine className="h-4 w-4" />
          <AlertTitle>Document Processing Info</AlertTitle>
          <AlertDescription className="space-y-2">
            {result.ocrInfo.filesProcessedWithOCR?.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <strong>OCR Applied:</strong> {result.ocrInfo.filesProcessedWithOCR.join(', ')}
                </span>
              </div>
            )}
            {result.ocrInfo.totalUnreadablePages > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <FileWarning className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {result.ocrInfo.totalUnreadablePages} page(s) could not be fully read
                </span>
              </div>
            )}
            {result.ocrInfo.warnings?.length > 0 && (
              <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                {result.ocrInfo.warnings.map((warning: string, index: number) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Case Type and Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Case Type(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.caseTypes?.map((type: string, index: number) => (
                <Badge key={index} variant="secondary">
                  {getCaseTypeLabel(type)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Prescription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getPrescriptionColor(result.prescriptionStatus?.status)}>
              {result.prescriptionStatus?.status === 'within_period' && 'Within Period'}
              {result.prescriptionStatus?.status === 'approaching' && 'Approaching Deadline'}
              {result.prescriptionStatus?.status === 'likely_expired' && 'Likely Expired'}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">
              {result.prescriptionStatus?.timeElapsed} elapsed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Attorney Conflict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={result.attorneyConflict?.hasConflict ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
              {result.attorneyConflict?.hasConflict ? 'Conflict Found' : 'No Conflict'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="facts" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="facts">Facts</TabsTrigger>
          <TabsTrigger value="injuries">Injuries</TabsTrigger>
          <TabsTrigger value="experts">Experts</TabsTrigger>
          <TabsTrigger value="viability">Viability</TabsTrigger>
          <TabsTrigger value="opinion">Opinion</TabsTrigger>
        </TabsList>

        {/* Facts Tab */}
        <TabsContent value="facts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Facts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.extractedFacts?.dateOfIncident && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Date of Incident</p>
                      <p className="text-sm text-muted-foreground">
                        {result.extractedFacts.dateOfIncident}
                      </p>
                    </div>
                  </div>
                )}
                {result.extractedFacts?.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {result.extractedFacts.location}
                      </p>
                    </div>
                  </div>
                )}
                {result.extractedFacts?.treatingFacility && (
                  <div className="flex items-start gap-2">
                    <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Treating Facility</p>
                      <p className="text-sm text-muted-foreground">
                        {result.extractedFacts.treatingFacility}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Nature of Incident</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {result.extractedFacts?.natureOfIncident || 'Not specified'}
                </p>
              </div>

              {result.extractedFacts?.injuriesSustained?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Injuries Sustained</p>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedFacts.injuriesSustained.map((injury: string, index: number) => (
                      <Badge key={index} variant="outline">{injury}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.extractedFacts?.treatmentReceived?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Treatment Received</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {result.extractedFacts.treatmentReceived.map((treatment: string, index: number) => (
                      <li key={index}>{treatment}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.extractedFacts?.missingDocuments?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-destructive">Missing Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedFacts.missingDocuments.map((doc: string, index: number) => (
                      <Badge key={index} variant="destructive">{doc}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.extractedFacts?.documentTypes?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Document Types Identified</p>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedFacts.documentTypes.map((type: string, index: number) => (
                      <Badge key={index} variant="secondary">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Injuries Tab */}
        <TabsContent value="injuries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Injury Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.injuries?.length > 0 ? (
                <div className="space-y-4">
                  {result.injuries.map((injury: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{injury.type}</h4>
                        <div className="flex gap-2">
                          <Badge variant="outline">{injury.category}</Badge>
                          <Badge className={getSeverityColor(injury.severity)}>
                            {injury.severity}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{injury.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No injuries identified</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experts Tab */}
        <TabsContent value="experts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Expert Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.expertRecommendations?.length > 0 ? (
                <div className="space-y-4">
                  {result.expertRecommendations.map((expert: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{expert.expertType}</h4>
                        <Badge className={getPriorityColor(expert.priority)}>
                          {expert.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{expert.reason}</p>
                      {expert.linkedToInjury && (
                        <p className="text-xs text-muted-foreground">
                          Linked to: {expert.linkedToInjury}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No expert recommendations</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Viability Tab */}
        <TabsContent value="viability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Case Viability Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Strength of Facts</p>
                  <Badge variant="outline" className="text-lg">
                    {result.viability?.strengthOfFacts || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Medical Consistency</p>
                  <Badge variant="outline" className="text-lg">
                    {result.viability?.medicalConsistency || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Injury Severity</p>
                  <Badge variant="outline" className="text-lg">
                    {result.viability?.injurySeverity || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Documentation</p>
                  <Badge variant="outline" className="text-lg">
                    {result.viability?.documentationQuality || 'N/A'}
                  </Badge>
                </div>
              </div>

              {result.viability?.reasons?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Assessment Reasons</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {result.viability.reasons.map((reason: string, index: number) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opinion Tab */}
        <TabsContent value="opinion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Screening Opinion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Disclaimer</AlertTitle>
                <AlertDescription className="text-xs">
                  {result.disclaimer}
                </AlertDescription>
              </Alert>

              <div>
                <p className="text-sm font-medium mb-2">Case Type Summary</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {result.screeningOpinion?.caseTypeSummary || 'Not available'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Facts Summary</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {result.screeningOpinion?.factsSummary || 'Not available'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Injuries Summary</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {result.screeningOpinion?.injuriesSummary || 'Not available'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Medical Consistency</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {result.screeningOpinion?.medicalConsistency || 'Not available'}
                </p>
              </div>

              {result.screeningOpinion?.legalIssues?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Potential Legal Issues</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {result.screeningOpinion.legalIssues.map((issue: string, index: number) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Final Recommendation</p>
                <p className="text-sm bg-muted p-3 rounded-md font-medium">
                  {result.screeningOpinion?.finalRecommendation || 'Not available'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaseScreeningResults;

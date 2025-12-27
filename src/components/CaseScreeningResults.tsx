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
  FileWarning,
  Eye,
  CreditCard,
  Timer,
  Car,
  Footprints,
  HeartPulse,
  Shield,
  TrendingUp,
  TrendingDown
} from "lucide-react";

interface CaseScreeningResultsProps {
  result: any;
}

const CaseScreeningResults = ({ result }: CaseScreeningResultsProps) => {
  const getViabilityColor = (recommendation: string) => {
    switch (recommendation) {
      case 'proceed':
      case 'take': return 'bg-green-100 text-green-800 border-green-200';
      case 'proceed_with_caution':
      case 'caution': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'do_not_proceed':
      case 'do_not_take': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getViabilityIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'proceed':
      case 'take': return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'proceed_with_caution':
      case 'caution': return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'do_not_proceed':
      case 'do_not_take': return <XCircle className="h-6 w-6 text-red-600" />;
      default: return <AlertCircle className="h-6 w-6" />;
    }
  };

  const getViabilityText = (recommendation: string) => {
    switch (recommendation) {
      case 'proceed':
      case 'take': return 'Proceed - Recommended to Take';
      case 'proceed_with_caution':
      case 'caution': return 'Proceed with Caution';
      case 'do_not_proceed':
      case 'do_not_take': return 'Do Not Proceed';
      default: return 'Assessment Pending';
    }
  };

  const getPrescriptionColor = (status: string) => {
    switch (status) {
      case 'safe':
      case 'within_period': return 'bg-green-100 text-green-800';
      case 'approaching': return 'bg-yellow-100 text-yellow-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      case 'expired':
      case 'likely_expired': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCaseTypeLabel = (type: string) => {
    switch (type) {
      case 'road_accident': return 'Road Accident (RAF)';
      case 'slip_and_fall': return 'Slip and Fall';
      case 'medical_negligence': return 'Medical Negligence';
      case 'unlawful_arrest': return 'Unlawful Arrest/Detention';
      default: return type;
    }
  };

  const getCaseTypeIcon = (type: string) => {
    switch (type) {
      case 'road_accident': return <Car className="h-4 w-4" />;
      case 'slip_and_fall': return <Footprints className="h-4 w-4" />;
      case 'medical_negligence': return <HeartPulse className="h-4 w-4" />;
      case 'unlawful_arrest': return <Shield className="h-4 w-4" />;
      default: return <Scale className="h-4 w-4" />;
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
      case 'mandatory':
      case 'high': return 'bg-red-100 text-red-800';
      case 'recommended':
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'optional':
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate': return 'bg-red-100 text-red-800';
      case 'within_30_days': return 'bg-orange-100 text-orange-800';
      case 'within_90_days': return 'bg-yellow-100 text-yellow-800';
      case 'standard': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getIdVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'mismatch_found': return 'bg-red-100 text-red-800';
      case 'incomplete': return 'bg-yellow-100 text-yellow-800';
      case 'not_provided': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'critical': return 'border-l-4 border-l-red-500 bg-red-50';
      case 'important': return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      case 'routine': return 'border-l-4 border-l-gray-300 bg-gray-50';
      default: return 'bg-muted';
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
      {(result.prescriptionAnalysis?.[0]?.status === 'urgent' || result.prescriptionAnalysis?.[0]?.status === 'expired') && (
        <Alert variant="destructive">
          <Clock className="h-4 w-4" />
          <AlertTitle>⚠️ Prescription Risk: {result.prescriptionAnalysis[0].status.toUpperCase()}</AlertTitle>
          <AlertDescription>
            {result.prescriptionAnalysis[0].recommendation}
            {result.prescriptionAnalysis[0].daysRemaining !== null && (
              <span className="block mt-1 font-medium">
                Days Remaining: {result.prescriptionAnalysis[0].daysRemaining}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ID Verification Alert */}
      {result.idVerification?.validationStatus === 'mismatch_found' && (
        <Alert variant="destructive">
          <CreditCard className="h-4 w-4" />
          <AlertTitle>ID Verification Mismatch</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-1">
              {result.idVerification.mismatches?.map((mismatch: string, index: number) => (
                <li key={index}>{mismatch}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Review Status Banner */}
      {result.reviewStatus === 'pending_review' && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Pending Admin Review</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            This screening opinion was generated from OCR-extracted text and requires admin review.
          </AlertDescription>
        </Alert>
      )}

      {/* OCR Processing Info */}
      {result.ocrInfo && (result.ocrInfo.filesProcessedWithOCR?.length > 0 || result.ocrInfo.warnings?.length > 0) && (
        <Alert variant={result.ocrInfo.requiresClearerCopy ? "destructive" : "default"}>
          <ScanLine className="h-4 w-4" />
          <AlertTitle>Document Processing Info</AlertTitle>
          <AlertDescription className="space-y-2">
            {result.ocrInfo.filesProcessedWithOCR?.length > 0 && (
              <p className="text-sm">
                <strong>OCR Applied to:</strong> {result.ocrInfo.filesProcessedWithOCR.join(', ')}
              </p>
            )}
            {result.ocrInfo.requiresClearerCopy && (
              <p className="text-sm font-medium text-destructive">
                ⚠️ Poor scan quality detected - upload clearer copies for better accuracy.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Case Type and Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {getCaseTypeIcon(type)}
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
              Prescription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getPrescriptionColor(result.prescriptionAnalysis?.[0]?.status || result.viability?.prescriptionRisk)}>
              {result.prescriptionAnalysis?.[0]?.status || result.viability?.prescriptionRisk || 'Unknown'}
            </Badge>
            {result.prescriptionAnalysis?.[0]?.daysRemaining !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                {result.prescriptionAnalysis[0].daysRemaining} days remaining
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              ID Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getIdVerificationColor(result.idVerification?.validationStatus)}>
              {result.idVerification?.validationStatus?.replace(/_/g, ' ') || 'Not Provided'}
            </Badge>
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
      <Tabs defaultValue="intelligence" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="injuries">Injuries</TabsTrigger>
          <TabsTrigger value="experts">Experts</TabsTrigger>
          <TabsTrigger value="viability">Viability</TabsTrigger>
          <TabsTrigger value="opinion">Opinion</TabsTrigger>
          <TabsTrigger value="review" className={result.reviewStatus === 'pending_review' ? 'text-amber-600' : ''}>
            Review
          </TabsTrigger>
        </TabsList>

        {/* Case Type Intelligence Tab */}
        <TabsContent value="intelligence" className="space-y-4">
          {/* ID Verification Card */}
          {result.idVerification && result.idVerification.validationStatus !== 'not_provided' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  ID Document Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.idVerification.fullName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="text-sm font-medium">{result.idVerification.fullName}</p>
                    </div>
                  )}
                  {result.idVerification.idNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">ID Number</p>
                      <p className="text-sm font-medium font-mono">{result.idVerification.idNumber}</p>
                    </div>
                  )}
                  {result.idVerification.dateOfBirth && (
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Birth</p>
                      <p className="text-sm font-medium">{result.idVerification.dateOfBirth}</p>
                    </div>
                  )}
                  {result.idVerification.ageAtIncident && (
                    <div>
                      <p className="text-xs text-muted-foreground">Age at Incident</p>
                      <p className="text-sm font-medium">{result.idVerification.ageAtIncident} years</p>
                    </div>
                  )}
                </div>
                <Badge className={getIdVerificationColor(result.idVerification.validationStatus)}>
                  {result.idVerification.idType?.replace(/_/g, ' ')} - {result.idVerification.validationStatus?.replace(/_/g, ' ')}
                </Badge>
                {result.idVerification.mismatches?.length > 0 && (
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <p className="text-sm font-medium text-red-800">Mismatches Detected:</p>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {result.idVerification.mismatches.map((m: string, i: number) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Case Type Intelligence */}
          {result.caseTypeIntelligence?.map((intel: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getCaseTypeIcon(intel.type)}
                  {getCaseTypeLabel(intel.type)} Analysis
                  <Badge variant="outline" className="ml-2">{intel.confidence}% confidence</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {intel.indicators?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Key Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {intel.indicators.map((ind: string, i: number) => (
                        <Badge key={i} variant="secondary">{ind}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {intel.specificFindings && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    {/* RAF Specific */}
                    {intel.type === 'road_accident' && (
                      <>
                        {intel.specificFindings.motorVehicleInvolved !== undefined && (
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            <span className="text-sm">Motor Vehicle: {intel.specificFindings.motorVehicleInvolved ? '✓ Confirmed' : '✗ Not Confirmed'}</span>
                          </div>
                        )}
                        {intel.specificFindings.accidentDate && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">Accident Date: {intel.specificFindings.accidentDate}</span>
                          </div>
                        )}
                        {intel.specificFindings.accidentLocation && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">Location: {intel.specificFindings.accidentLocation}</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Slip & Fall Specific */}
                    {intel.type === 'slip_and_fall' && (
                      <>
                        {intel.specificFindings.premisesOwner && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            <span className="text-sm">Premises Owner: {intel.specificFindings.premisesOwner}</span>
                          </div>
                        )}
                        {intel.specificFindings.fallCause && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">Cause: {intel.specificFindings.fallCause}</span>
                          </div>
                        )}
                        {intel.specificFindings.incidentReportAvailable !== undefined && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">Incident Report: {intel.specificFindings.incidentReportAvailable ? '✓ Available' : '✗ Missing'}</span>
                          </div>
                        )}
                        {intel.specificFindings.negligenceIndicators?.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-sm font-medium mb-1">Negligence Indicators:</p>
                            <div className="flex flex-wrap gap-1">
                              {intel.specificFindings.negligenceIndicators.map((n: string, i: number) => (
                                <Badge key={i} variant="destructive" className="text-xs">{n}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Medical Negligence Specific */}
                    {intel.type === 'medical_negligence' && (
                      <>
                        {intel.specificFindings.healthcareProviders?.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-sm font-medium mb-1">Healthcare Providers:</p>
                            <div className="flex flex-wrap gap-1">
                              {intel.specificFindings.healthcareProviders.map((p: string, i: number) => (
                                <Badge key={i} variant="outline">{p}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {intel.specificFindings.standardOfCareDeviations?.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-sm font-medium mb-1 text-red-700">Standard of Care Deviations:</p>
                            <ul className="list-disc list-inside text-sm text-red-600">
                              {intel.specificFindings.standardOfCareDeviations.map((d: string, i: number) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Extracted Facts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Facts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.extractedFacts?.dateOfIncident && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Date of Incident</p>
                      <p className="text-sm text-muted-foreground">{result.extractedFacts.dateOfIncident}</p>
                    </div>
                  </div>
                )}
                {result.extractedFacts?.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{result.extractedFacts.location}</p>
                    </div>
                  </div>
                )}
                {result.extractedFacts?.treatingFacility && (
                  <div className="flex items-start gap-2">
                    <Building className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Treating Facility</p>
                      <p className="text-sm text-muted-foreground">{result.extractedFacts.treatingFacility}</p>
                    </div>
                  </div>
                )}
              </div>

              {result.extractedFacts?.natureOfIncident && (
                <div>
                  <p className="text-sm font-medium mb-2">Nature of Incident</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    {result.extractedFacts.natureOfIncident}
                  </p>
                </div>
              )}

              {result.extractedFacts?.documentTypes?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Documents Identified</p>
                  <div className="flex flex-wrap gap-2">
                    {result.extractedFacts.documentTypes.map((type: string, index: number) => (
                      <Badge key={index} variant="secondary">{type.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Case Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.timeline?.length > 0 ? (
                <div className="space-y-3">
                  {result.timeline.map((event: any, index: number) => (
                    <div key={index} className={`p-3 rounded-lg ${getSignificanceColor(event.significance)}`}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{event.date}</Badge>
                          <Badge variant="secondary" className="text-xs">{event.eventType}</Badge>
                        </div>
                        <Badge className={getSeverityColor(event.significance === 'critical' ? 'critical' : event.significance === 'important' ? 'moderate' : 'minor')}>
                          {event.significance}
                        </Badge>
                      </div>
                      <p className="text-sm">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Source: {event.source}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No timeline events extracted</p>
              )}
            </CardContent>
          </Card>

          {/* Prescription Analysis */}
          {result.prescriptionAnalysis?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Prescription Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.prescriptionAnalysis.map((pa: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCaseTypeIcon(pa.caseType)}
                          <span className="font-medium">{getCaseTypeLabel(pa.caseType)}</span>
                        </div>
                        <Badge className={getPrescriptionColor(pa.status)}>{pa.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {pa.incidentDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">Incident Date</p>
                            <p className="font-medium">{pa.incidentDate}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Prescription Period</p>
                          <p className="font-medium">{pa.prescriptionPeriodYears} years</p>
                        </div>
                        {pa.expiryDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">Expiry Date</p>
                            <p className="font-medium">{pa.expiryDate}</p>
                          </div>
                        )}
                        {pa.daysRemaining !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Days Remaining</p>
                            <p className={`font-medium ${pa.daysRemaining < 90 ? 'text-red-600' : pa.daysRemaining < 180 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {pa.daysRemaining}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{pa.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
                          <Badge className={getSeverityColor(injury.severity)}>{injury.severity}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{injury.description}</p>
                      {injury.linkedToCaseType && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          {getCaseTypeIcon(injury.linkedToCaseType)}
                          Linked to: {getCaseTypeLabel(injury.linkedToCaseType)}
                        </p>
                      )}
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
                        <div className="flex gap-2">
                          <Badge className={getPriorityColor(expert.priority)}>
                            {expert.priority}
                          </Badge>
                          {expert.urgency && (
                            <Badge className={getUrgencyColor(expert.urgency)}>
                              {expert.urgency?.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{expert.reason}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {expert.linkedToInjury && (
                          <span className="text-muted-foreground">Injury: {expert.linkedToInjury}</span>
                        )}
                        {expert.linkedToCaseType && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            {getCaseTypeIcon(expert.linkedToCaseType)}
                            {getCaseTypeLabel(expert.linkedToCaseType)}
                          </span>
                        )}
                      </div>
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Strength of Facts</p>
                  <Badge variant="outline" className="text-lg">{result.viability?.strengthOfFacts || 'N/A'}</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Medical Consistency</p>
                  <Badge variant="outline" className="text-lg">{result.viability?.medicalConsistency || 'N/A'}</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Injury Severity</p>
                  <Badge variant="outline" className="text-lg">{result.viability?.injurySeverity || 'N/A'}</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Documentation</p>
                  <Badge variant="outline" className="text-lg">{result.viability?.documentationQuality || 'N/A'}</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Prescription Risk</p>
                  <Badge className={getPrescriptionColor(result.viability?.prescriptionRisk)}>{result.viability?.prescriptionRisk || 'N/A'}</Badge>
                </div>
              </div>

              {/* Strengths */}
              {result.viability?.strengthAreas?.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2 text-green-800">
                    <TrendingUp className="h-4 w-4" /> Strengths
                  </p>
                  <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                    {result.viability.strengthAreas.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {result.viability?.weaknessAreas?.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2 text-red-800">
                    <TrendingDown className="h-4 w-4" /> Weaknesses
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                    {result.viability.weaknessAreas.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Documents */}
              {result.viability?.missingDocumentsList?.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2 text-yellow-800">
                    <FileWarning className="h-4 w-4" /> Missing Documents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.viability.missingDocumentsList.map((doc: string, i: number) => (
                      <Badge key={i} variant="outline" className="bg-yellow-100 text-yellow-800">{doc}</Badge>
                    ))}
                  </div>
                </div>
              )}

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
                <AlertDescription className="text-xs">{result.disclaimer}</AlertDescription>
              </Alert>

              {result.screeningOpinion?.caseTypeSummary && (
                <div>
                  <p className="text-sm font-medium mb-2">Case Type Summary</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{result.screeningOpinion.caseTypeSummary}</p>
                </div>
              )}

              {result.screeningOpinion?.factsSummary && (
                <div>
                  <p className="text-sm font-medium mb-2">Facts Summary</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{result.screeningOpinion.factsSummary}</p>
                </div>
              )}

              {result.screeningOpinion?.injuriesSummary && (
                <div>
                  <p className="text-sm font-medium mb-2">Injuries Summary</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">{result.screeningOpinion.injuriesSummary}</p>
                </div>
              )}

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

              {result.screeningOpinion?.finalRecommendation && (
                <div>
                  <p className="text-sm font-medium mb-2">Final Recommendation</p>
                  <p className="text-sm bg-muted p-3 rounded-md font-medium">{result.screeningOpinion.finalRecommendation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Admin Review - Extracted Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.extractedTextPreview && (
                <div>
                  <p className="text-sm font-medium mb-2">Extracted Text Preview</p>
                  <div className="max-h-96 overflow-y-auto bg-muted p-4 rounded-lg">
                    <pre className="text-xs whitespace-pre-wrap font-mono">{result.extractedTextPreview}</pre>
                  </div>
                </div>
              )}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Review Status</p>
                <Badge className={result.reviewStatus === 'approved' ? 'bg-green-100 text-green-800' : result.reviewStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                  {result.reviewStatus === 'approved' ? '✓ Approved' : result.reviewStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending Review'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaseScreeningResults;

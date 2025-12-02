import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Clock, AlertTriangle, Loader2, Activity, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { DocumentViewer } from "@/components/DocumentViewer";
import { jsPDF } from "jspdf";
import { addBrandingToPDF, addBrandingFooter } from "@/utils/pdfBranding";

interface ProofreadingResult {
  success?: boolean;
  error?: string;
  originalText: string;
  correctedText: string;
  changes: {
    type: string;
    original: string;
    corrected: string;
    line: number;
    reason: string;
  }[];
  qualityScore: number;
  issues: {
    category: string;
    severity: string;
    message: string;
  }[];
  metadata: {
    totalWords: number;
    totalSentences: number;
    readingLevel: string;
    processingTime: number;
    chunksProcessed?: number;
    compressionApplied?: boolean;
    originalSize?: string;
    compressedSize?: string;
    chunkCount?: number;
  };
  recommendation?: string;
}

const DocumentProofreading = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProofreadingResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [negligenceHistory, setNegligenceHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const [negligenceResult, setNegligenceResult] = useState<any | null>(null);
  const [loadingNegligence, setLoadingNegligence] = useState(false);

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-proofreading';

  // Load proofreading history
  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('proofreading_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  // Load negligence analysis history
  const loadNegligenceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('negligence_analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNegligenceHistory(data || []);
    } catch (error) {
      console.error('Failed to load negligence history:', error);
    }
  };

  React.useEffect(() => {
    loadHistory();
    loadNegligenceHistory();
  }, []);

  const handleNegligenceAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, Word document, or text file.",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 20MB.",
          variant: "destructive",
        });
        return;
      }

      setLoadingNegligence(true);
      setNegligenceResult(null);

      try {
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        const { data, error } = await supabase.functions.invoke('analyze-medical-negligence', {
          body: {
            fileData: fileData.split(',')[1],
            fileName: selectedFile.name,
            fileType: selectedFile.type,
          },
        });

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        setNegligenceResult(data);
        toast({
          title: "Analysis complete",
          description: `Found ${data.negligenceIndicators.length} potential negligence indicators.`,
        });
        loadNegligenceHistory(); // Reload history after analysis
      } catch (error: any) {
        console.error('Analysis error:', error);
        
        let errorTitle = "Analysis Failed";
        let errorDescription = "Failed to analyze document";
        
        if (error?.message) {
          errorDescription = error.message;
        } else if (typeof error === 'string') {
          errorDescription = error;
        }
        
        // Check for specific error types
        if (errorDescription.includes('scanned') || errorDescription.includes('OCR')) {
          errorTitle = "Scanned Document Detected";
        } else if (errorDescription.includes('rate limit')) {
          errorTitle = "Rate Limit Exceeded";
        } else if (errorDescription.includes('credits')) {
          errorTitle = "Service Unavailable";
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
          duration: 7000,
        });
      } finally {
        setLoadingNegligence(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF, Word document, or text file.",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 20MB (approximately 40 pages).",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleProofread = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a document to proofread.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(30);

      const { data, error } = await supabase.functions.invoke('proofread-document', {
        body: {
          fileData: fileData.split(',')[1],
          fileName: file.name,
          fileType: file.type,
        },
      });

      setProgress(90);

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success === false) {
        throw new Error(data.error || 'Proofreading failed');
      }

      setResult(data);
      setProgress(100);

      const successMessage = data.metadata?.compressionApplied
        ? `Large document compressed from ${data.metadata.originalSize} to ${data.metadata.compressedSize}. Quality score: ${data.qualityScore}%.`
        : `Quality score: ${data.qualityScore}%. Found ${data.changes.length} corrections.`;

      toast({
        title: "Proofreading complete",
        description: successMessage,
      });
      
      loadHistory();
    } catch (error) {
      console.error('Proofreading error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to proofread document",
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCorrectedDocument = () => {
    if (!result?.correctedText) return;
    
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'Proofread Document', `Original: ${file?.name || 'document'}`);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = { left: 20, right: 20, top: startY + 10, bottom: 30 };
    const maxLineWidth = pageWidth - margins.left - margins.right;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    const lines = doc.splitTextToSize(result.correctedText, maxLineWidth);
    let currentY = margins.top;
    
    lines.forEach((line: string) => {
      if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
        doc.addPage();
        currentY = margins.top;
      }
      doc.text(line, margins.left, currentY);
      currentY += 6;
    });
    
    addBrandingFooter(doc);
    
    const fileName = file?.name?.replace(/\.[^/.]+$/, '') || 'document';
    doc.save(`proofread_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Proofread document saved as PDF.",
    });
  };

  const downloadNegligenceReport = () => {
    if (!negligenceResult) return;
    
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'Medical Negligence Analysis Report', `File: ${negligenceResult.fileName}`);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = { left: 20, right: 20, top: startY + 10, bottom: 30 };
    const maxLineWidth = pageWidth - margins.left - margins.right;
    let currentY = margins.top;

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
        doc.addPage();
        currentY = margins.top;
      }
      doc.setFontSize(fontSize);
      if (isBold) doc.setFont(undefined, 'bold');
      else doc.setFont(undefined, 'normal');
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      lines.forEach((line: string) => {
        if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
          doc.addPage();
          currentY = margins.top;
        }
        doc.text(line, margins.left, currentY);
        currentY += fontSize * 0.5;
      });
      currentY += 3;
    };

    // Overall Severity
    addText(`Overall Severity: ${negligenceResult.overallSeverity.toUpperCase()}`, 12, true);
    currentY += 5;

    // Negligence Indicators
    if (negligenceResult.negligenceIndicators.length > 0) {
      addText('NEGLIGENCE INDICATORS', 12, true);
      currentY += 2;
      
      negligenceResult.negligenceIndicators.forEach((indicator: any, idx: number) => {
        addText(`${idx + 1}. ${indicator.category.replace(/_/g, ' ').toUpperCase()}`, 10, true);
        addText(`Finding: ${indicator.finding}`);
        addText(`Severity: ${indicator.severity}`);
        addText(`Evidence: ${indicator.evidence}`);
        currentY += 3;
      });
    }

    // Key Evidence
    if (negligenceResult.keyEvidence.length > 0) {
      currentY += 5;
      addText('KEY EVIDENCE', 12, true);
      currentY += 2;
      
      negligenceResult.keyEvidence.forEach((evidence: any, idx: number) => {
        addText(`${idx + 1}. ${evidence.type.toUpperCase()}`, 10, true);
        if (evidence.date) addText(`Date: ${evidence.date}`);
        addText(`Description: ${evidence.description}`);
        addText(`Relevance: ${evidence.relevance}`);
        currentY += 3;
      });
    }

    // Expert Recommendations
    if (negligenceResult.expertRecommendations.length > 0) {
      currentY += 5;
      addText('EXPERT RECOMMENDATIONS', 12, true);
      currentY += 2;
      
      negligenceResult.expertRecommendations.forEach((rec: any, idx: number) => {
        addText(`${idx + 1}. ${rec.expertType}`, 10, true);
        addText(`Priority: ${rec.priority}`);
        addText(`Reason: ${rec.reason}`);
        currentY += 3;
      });
    }
    
    addBrandingFooter(doc);
    
    const fileName = negligenceResult.fileName?.replace(/\.[^/.]+$/, '') || 'negligence_analysis';
    doc.save(`negligence_analysis_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Negligence analysis report saved as PDF.",
    });
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      high: "destructive",
      medium: "default",
      low: "secondary",
      info: "outline",
    };
    return variants[severity.toLowerCase()] || "default";
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Document Proofreading - Medico-Legal Assessment System</title>
        <meta name="description" content="AI-powered proofreading and medical negligence analysis for medico-legal reports." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="relative">
            <Link to="/" className="inline-block mb-4">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">Document Proofreading & Analysis</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              AI-powered proofreading and medical negligence analysis for medico-legal reports with automated checks and expert recommendations.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* History Toggle Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {showHistory ? 'Hide History' : `View History (${history.length})`}
            </Button>
          </div>

          {/* History Section */}
          {showHistory && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Proofreading History</h2>
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No proofreading history yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {history.map((record) => (
                      <div key={record.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium">{record.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={record.quality_score >= 90 ? "default" : record.quality_score >= 70 ? "secondary" : "destructive"}>
                            {record.quality_score}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Changes</p>
                            <p className="font-medium">{record.total_changes}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Words</p>
                            <p className="font-medium">{record.total_words.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Time</p>
                            <p className="font-medium">{record.processing_time}s</p>
                          </div>
                        </div>
                        {record.compression_applied && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                            <CheckCircle className="h-3 w-3" />
                            Compression applied: {record.original_size} → {record.compressed_size}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  History is automatically deleted after 30 days
                </p>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Negligence Analysis History</h2>
                {negligenceHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No negligence analysis history yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {negligenceHistory.map((record) => (
                      <div key={record.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium">{record.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={record.overall_severity === 'high' ? "destructive" : record.overall_severity === 'medium' ? "default" : "secondary"}>
                            {record.overall_severity}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Indicators</p>
                            <p className="font-medium">{record.indicator_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Evidence</p>
                            <p className="font-medium">{record.evidence_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Time</p>
                            <p className="font-medium">{record.processing_time}s</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue="proofread">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="proofread">Proofread Document</TabsTrigger>
              <TabsTrigger value="negligence">Negligence Analysis</TabsTrigger>
            </TabsList>

            {/* Proofreading Tab */}
            <TabsContent value="proofread" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Upload Document</h2>
                  </div>
                  
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="document-upload"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <label htmlFor="document-upload" className="cursor-pointer">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {file ? file.name : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, Word Document, or Text File (Max 20MB)
                      </p>
                    </label>
                  </div>

                  {file && (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button onClick={handleProofread} disabled={isProcessing}>
                        {isProcessing ? "Processing..." : "Start Proofreading"}
                      </Button>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="space-y-2">
                      <Progress value={progress} />
                      <p className="text-sm text-muted-foreground text-center">
                        Processing document... {progress}%
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Results Section */}
              {result && (
                <>
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold mb-2">Quality Score</h2>
                        <p className="text-sm text-muted-foreground">
                          Based on {result.metadata.totalWords} words and {result.metadata.totalSentences} sentences
                        </p>
                      </div>
                      <div className={`text-5xl font-bold ${getQualityColor(result.qualityScore)}`}>
                        {result.qualityScore}%
                      </div>
                    </div>
                  </Card>

                  {result.issues.length > 0 && (
                    <Card className="p-6 border-yellow-500">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">Document Quality Alerts</h3>
                          <div className="space-y-2">
                            {result.issues.map((issue, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Badge variant={getSeverityBadge(issue.severity)}>
                                  {issue.severity}
                                </Badge>
                                <span className="text-sm">{issue.category}: {issue.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {result.recommendation && (
                    <Card className="p-6 border-blue-500">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">Recommendation</h3>
                          <p className="text-sm text-muted-foreground">{result.recommendation}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  <Card className="p-6">
                    <Tabs defaultValue="document" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="document">
                          Document ({result.changes.length} errors)
                        </TabsTrigger>
                        <TabsTrigger value="changes">
                          Changes List
                        </TabsTrigger>
                        <TabsTrigger value="original">Original</TabsTrigger>
                        <TabsTrigger value="corrected">Corrected</TabsTrigger>
                      </TabsList>

                      <TabsContent value="document" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="show-corrections"
                              checked={showCorrections}
                              onCheckedChange={setShowCorrections}
                            />
                            <Label htmlFor="show-corrections" className="cursor-pointer">
                              Show corrections
                            </Label>
                          </div>
                          <Button variant="outline" onClick={downloadCorrectedDocument}>
                            Download Corrected Version
                          </Button>
                        </div>
                        <DocumentViewer
                          text={result.originalText}
                          changes={result.changes}
                          showCorrections={showCorrections}
                        />
                      </TabsContent>

                      <TabsContent value="changes" className="space-y-4 mt-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={downloadCorrectedDocument}>
                            Download Corrected Version
                          </Button>
                        </div>
                        
                        {result.changes.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                            <p>No corrections needed! Document is in excellent condition.</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {result.changes.map((change, idx) => (
                              <div key={idx} className="p-4 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{change.type}</Badge>
                                  <span className="text-xs text-muted-foreground">Line {change.line}</span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    <span className="text-red-600 line-through">{change.original}</span>
                                    {" → "}
                                    <span className="text-green-600 font-medium">{change.corrected}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground italic">{change.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="original" className="mt-4">
                        <div className="p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm">{result.originalText}</pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="corrected" className="mt-4">
                        <div className="p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm">{result.correctedText}</pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </Card>

                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Document Metadata</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Words</p>
                        <p className="text-xl font-semibold">{result.metadata.totalWords}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sentences</p>
                        <p className="text-xl font-semibold">{result.metadata.totalSentences}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reading Level</p>
                        <p className="text-xl font-semibold">{result.metadata.readingLevel}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Processing Time</p>
                        <p className="text-xl font-semibold">{result.metadata.processingTime}s</p>
                      </div>
                      {result.metadata.compressionApplied && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Original Size</p>
                            <p className="text-xl font-semibold">{result.metadata.originalSize}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Compressed Size</p>
                            <p className="text-xl font-semibold">{result.metadata.compressedSize}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Large Chunks</p>
                            <p className="text-xl font-semibold">{result.metadata.chunkCount}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Compression</p>
                            <p className="text-xl font-semibold text-green-600">Applied ✓</p>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Negligence Analysis Tab */}
            <TabsContent value="negligence" className="space-y-6">
              {/* Important Info Alert */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Important: Text-Based Documents Only
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        This analysis requires searchable text. If you have a <strong>scanned PDF</strong>, please convert it to text using OCR software first, or upload a Word document or text file instead.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        ✓ Supported: Native PDFs, Word documents (.docx), Text files (.txt)<br/>
                        ✗ Not supported: Scanned PDFs, Image-based documents
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Medical Negligence Analysis
                  </CardTitle>
                  <CardDescription>
                    Upload medical or clinical records to analyze for potential negligence, extract key evidence, and get expert recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="negligence-upload"
                      onChange={handleNegligenceAnalysis}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      disabled={loadingNegligence}
                    />
                    <label htmlFor="negligence-upload" className="cursor-pointer">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Click to upload medical/clinical records
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Searchable PDF, Word Document, or Text File (Max 20MB)
                      </p>
                    </label>
                  </div>

                  {loadingNegligence && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-muted-foreground">Analyzing document for negligence indicators...</span>
                      </div>
                      <div className="text-center text-xs text-muted-foreground">
                        This may take 30-60 seconds for large documents
                      </div>
                    </div>
                  )}

                  {negligenceResult && (
                    <div className="space-y-6">
                      {/* Overall Assessment with Stats */}
                      <Card className={`border-2 shadow-lg ${
                        negligenceResult.overallSeverity === 'high' ? 'border-destructive bg-destructive/5' :
                        negligenceResult.overallSeverity === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' :
                        'border-green-500 bg-green-50 dark:bg-green-950/30'
                      }`}>
                        <CardHeader>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2 text-2xl">
                                <AlertTriangle className={`h-6 w-6 ${
                                  negligenceResult.overallSeverity === 'high' ? 'text-destructive' :
                                  negligenceResult.overallSeverity === 'medium' ? 'text-yellow-600' :
                                  'text-green-600'
                                }`} />
                                Analysis Complete
                              </CardTitle>
                              <CardDescription className="text-base mt-2">
                                {negligenceResult.fileName}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                              <Button onClick={downloadNegligenceReport} variant="outline" className="gap-2">
                                <FileText className="h-4 w-4" />
                                Download PDF Report
                              </Button>
                              <Badge 
                                variant={negligenceResult.overallSeverity === 'high' ? 'destructive' : 'default'}
                                className="text-lg px-4 py-2"
                              >
                                {negligenceResult.overallSeverity.toUpperCase()} SEVERITY
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                              <p className="text-3xl font-bold text-red-700 dark:text-red-400">{negligenceResult.metadata.indicatorCount}</p>
                              <p className="text-sm text-red-600 dark:text-red-300 font-medium">Indicators</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{negligenceResult.metadata.evidenceCount}</p>
                              <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Evidence Items</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                              <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{negligenceResult.metadata.recommendationCount}</p>
                              <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">Experts Needed</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{negligenceResult.metadata.processingTime}s</p>
                              <p className="text-sm text-green-600 dark:text-green-300 font-medium">Processing Time</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Negligence Indicators */}
                      {negligenceResult.negligenceIndicators.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Negligence Indicators</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {negligenceResult.negligenceIndicators.map((indicator: any, index: number) => (
                                <Card key={index} className="border-l-4" style={{
                                  borderLeftColor: indicator.severity === 'high' ? 'hsl(var(--destructive))' :
                                                  indicator.severity === 'medium' ? 'hsl(210 100% 50%)' :
                                                  'hsl(var(--muted-foreground))'
                                }}>
                                  <CardContent className="pt-4 space-y-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <Badge variant={
                                        indicator.severity === 'high' ? 'destructive' :
                                        indicator.severity === 'medium' ? 'secondary' :
                                        'outline'
                                      }>
                                        {indicator.category.replace(/_/g, ' ').toUpperCase()}
                                      </Badge>
                                      <Badge variant="outline">
                                        {indicator.severity.toUpperCase()} SEVERITY
                                      </Badge>
                                    </div>
                                    
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1">Finding:</h4>
                                      <p className="text-sm">{indicator.finding}</p>
                                    </div>
                                    
                                    {indicator.clinicalContext && (
                                      <div className="bg-muted/50 p-3 rounded-md">
                                        <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                                          <Activity className="h-4 w-4" />
                                          Clinical Context:
                                        </h4>
                                        <p className="text-sm text-muted-foreground">{indicator.clinicalContext}</p>
                                      </div>
                                    )}
                                    
                                    {indicator.causalLink && (
                                      <div>
                                        <h4 className="font-semibold text-sm mb-1">Causal Link to Harm:</h4>
                                        <p className="text-sm text-muted-foreground">{indicator.causalLink}</p>
                                      </div>
                                    )}
                                    
                                    {indicator.standardsViolated && (
                                      <div>
                                        <h4 className="font-semibold text-sm mb-1">Standards Violated:</h4>
                                        <p className="text-sm text-muted-foreground">{indicator.standardsViolated}</p>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1">Supporting Evidence:</h4>
                                      <p className="text-sm text-muted-foreground italic">{indicator.evidence}</p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Expert Recommendations */}
                      {negligenceResult.expertRecommendations.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Recommended Medical Experts</CardTitle>
                            <CardDescription>
                              {negligenceResult.expertRecommendations.length} expert types recommended for case review
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {negligenceResult.expertRecommendations.map((rec: any, index: number) => (
                                <Card key={index}>
                                  <CardContent className="pt-4 space-y-3">
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className="font-semibold flex items-center gap-2">
                                        <UserCheck className="h-5 w-5" />
                                        {rec.expertType}
                                      </h4>
                                      <Badge variant={
                                        rec.priority === 'high' ? 'destructive' :
                                        rec.priority === 'medium' ? 'secondary' :
                                        'outline'
                                      }>
                                        {rec.priority.toUpperCase()} PRIORITY
                                      </Badge>
                                    </div>
                                    
                                    <div>
                                      <h5 className="font-semibold text-sm mb-1">Justification:</h5>
                                      <p className="text-sm text-muted-foreground">{rec.reason}</p>
                                    </div>
                                    
                                    {rec.specificReviewAreas && (
                                      <div className="bg-muted/50 p-3 rounded-md">
                                        <h5 className="font-semibold text-sm mb-1">Specific Review Areas:</h5>
                                        <p className="text-sm text-muted-foreground">{rec.specificReviewAreas}</p>
                                      </div>
                                    )}
                                    
                                    {rec.expectedContribution && (
                                      <div>
                                        <h5 className="font-semibold text-sm mb-1">Expected Contribution:</h5>
                                        <p className="text-sm text-muted-foreground">{rec.expectedContribution}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Key Evidence */}
                      {negligenceResult.keyEvidence.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Clock className="h-5 w-5 text-primary" />
                              Key Evidence Timeline
                            </CardTitle>
                            <CardDescription>
                              {negligenceResult.keyEvidence.length} critical events extracted from medical records
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {negligenceResult.keyEvidence.slice(0, 10).map((evidence: any, index: number) => (
                                <div key={index} className="flex gap-4 relative">
                                  <div className="flex flex-col items-center">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                      evidence.type === 'procedure' ? 'bg-blue-100 dark:bg-blue-950' :
                                      evidence.type === 'medication' ? 'bg-purple-100 dark:bg-purple-950' :
                                      evidence.type === 'diagnosis' ? 'bg-red-100 dark:bg-red-950' :
                                      evidence.type === 'test' ? 'bg-green-100 dark:bg-green-950' :
                                      'bg-gray-100 dark:bg-gray-950'
                                    }`}>
                                      <Clock className={`h-5 w-5 ${
                                        evidence.type === 'procedure' ? 'text-blue-600 dark:text-blue-400' :
                                        evidence.type === 'medication' ? 'text-purple-600 dark:text-purple-400' :
                                        evidence.type === 'diagnosis' ? 'text-red-600 dark:text-red-400' :
                                        evidence.type === 'test' ? 'text-green-600 dark:text-green-400' :
                                        'text-gray-600 dark:text-gray-400'
                                      }`} />
                                    </div>
                                    {index < Math.min(negligenceResult.keyEvidence.length - 1, 9) && (
                                      <div className="w-0.5 flex-1 bg-gradient-to-b from-border to-transparent mt-2 min-h-[60px]" />
                                    )}
                                  </div>
                                  <div className="flex-1 pb-4">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Badge variant="outline" className="capitalize">
                                        {evidence.type}
                                      </Badge>
                                      {evidence.date && (
                                        <span className="text-sm font-medium text-muted-foreground">
                                          {evidence.date}
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-medium text-foreground mb-1">{evidence.description}</p>
                                    <p className="text-sm text-muted-foreground italic mb-1">{evidence.relevance}</p>
                                    {evidence.linkedIndicators && (
                                      <p className="text-xs text-primary/70 mt-1">
                                        <strong>Linked to:</strong> {evidence.linkedIndicators}
                                      </p>
                                    )}
                                    {evidence.clinicalSignificance && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">
                                        {evidence.clinicalSignificance}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {negligenceResult.keyEvidence.length > 10 && (
                                <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                                  Showing 10 of {negligenceResult.keyEvidence.length} evidence items
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Medical Context Summary */}
                      {negligenceResult.medicalContext && (
                        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Activity className="h-5 w-5 text-primary" />
                              Medical Context Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {negligenceResult.medicalContext.patientTimeline && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Patient Timeline:</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{negligenceResult.medicalContext.patientTimeline}</p>
                              </div>
                            )}
                            
                            {negligenceResult.medicalContext.standardOfCare && (
                              <div className="bg-background/50 p-4 rounded-md border border-primary/10">
                                <h4 className="font-semibold text-sm mb-2">Standard of Care:</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{negligenceResult.medicalContext.standardOfCare}</p>
                              </div>
                            )}
                            
                            {negligenceResult.medicalContext.causalChain && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Causal Chain:</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">{negligenceResult.medicalContext.causalChain}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Metadata */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Analysis Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Processing Time</p>
                              <p className="font-medium">{negligenceResult.metadata.processingTime}s</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Document Length</p>
                              <p className="font-medium">{negligenceResult.metadata.documentLength.toLocaleString()} chars</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Chunks Processed</p>
                              <p className="font-medium">{negligenceResult.metadata.chunksProcessed}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Indicators Found</p>
                              <p className="font-medium">{negligenceResult.metadata.indicatorCount}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default DocumentProofreading;

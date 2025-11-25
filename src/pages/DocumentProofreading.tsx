import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";

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

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-proofreading';

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

      if (selectedFile.size > 20 * 1024 * 1024) { // 20MB limit
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
      // Convert file to base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(30);

      // Call edge function for proofreading
      const { data, error } = await supabase.functions.invoke('proofread-document', {
        body: {
          fileData: fileData.split(',')[1], // Remove data URL prefix
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
    if (!result) return;

    const blob = new Blob([result.correctedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corrected_${file?.name || 'document'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: "Corrected document is being downloaded.",
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
        <meta name="description" content="AI-powered proofreading for medico-legal reports with automated spelling, grammar, and medical terminology checks." />
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
            <h1 className="text-3xl md:text-4xl font-bold">Document Proofreading</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              AI-powered proofreading for medico-legal reports with automated spelling, grammar, medical terminology, and accuracy checks.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Section */}
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
              {/* Quality Score Card */}
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

              {/* Issues Alert */}
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

              {/* Recommendation */}
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

              {/* Tabs for Changes and Text */}
              <Card className="p-6">
                <Tabs defaultValue="changes" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="changes">
                      Changes ({result.changes.length})
                    </TabsTrigger>
                    <TabsTrigger value="original">Original Text</TabsTrigger>
                    <TabsTrigger value="corrected">Corrected Text</TabsTrigger>
                  </TabsList>

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

              {/* Metadata */}
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
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default DocumentProofreading;

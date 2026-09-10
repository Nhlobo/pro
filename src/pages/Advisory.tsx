import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import {
  FileText,
  Scale,
  Loader2,
  Upload,
  X,
  Download,
  FileDown,
  Eye,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import DashboardStickyHeader from "@/components/dashboard/DashboardStickyHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { NegligenceAnalysisResults } from "@/components/NegligenceAnalysisResults";
import { MeritReportGenerator } from "@/components/MeritReportGenerator";
import { jsPDF } from "jspdf";
import { addBrandingToPDF, addBrandingFooter } from "@/utils/pdfBranding";
import { buildNegligenceWordReport, downloadBlob } from "@/utils/negligenceWordReport";

const SUPABASE_FUNCTIONS_URL = "https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1";
const ADVISORY_BUCKET = "advisory-documents";
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
];
// Client requirement: minimum 500MB per file for large hospital record
// bundles. Files are uploaded straight to Storage (advisory-documents
// bucket, 600MB bucket limit) rather than embedded in the analysis
// request, so this can safely sit at the client's stated minimum.
const MAX_FILE_SIZE = 500 * 1024 * 1024;
// Small files skip the Storage round-trip and go straight to the analysis
// function inline, for lower latency on the common case (single scanned
// page, a short discharge summary, etc).
const INLINE_UPLOAD_THRESHOLD = 15 * 1024 * 1024;

const Advisory = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  // Eye button on a history row opens the result card below the history
  // list — scroll it into view so the click has a visible effect instead
  // of silently updating something off-screen. Runs after the card has
  // actually rendered (ref is only non-null once selectedHistoryItem is
  // set), not on every render.
  useEffect(() => {
    if (selectedHistoryItem && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedHistoryItem]);

  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("negligence_analysis_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistory(data || []);
      const processing = data?.filter((d) => d.status === "processing" || d.status === "pending") || [];
      if (processing.length > 0 && !pendingTaskId) {
        setPendingTaskId(processing[0].id);
      }
    } catch (error) {
      console.error("Failed to load Advisory history:", error);
    }
  }, [pendingTaskId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Poll for background task completion / failure
  useEffect(() => {
    if (!pendingTaskId) return;
    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from("negligence_analysis_history")
        .select("*")
        .eq("id", pendingTaskId)
        .single();

      if (error || !data) {
        setPendingTaskId(null);
        return;
      }

      if (data.status === "completed" && data.analysis_result) {
        setResult(data.analysis_result);
        setPendingTaskId(null);
        setLoading(false);
        toast({
          title: "Advisory analysis complete",
          description: `Found ${data.indicator_count} potential negligence indicator(s).`,
        });
        loadHistory();
      } else if (data.status === "failed") {
        setPendingTaskId(null);
        setLoading(false);
        const errData = data.analysis_result as Record<string, unknown> | null;
        toast({
          title: "Advisory analysis failed",
          description: (errData?.error as string) || "An error occurred during analysis.",
          variant: "destructive",
        });
        loadHistory();
      }
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [pendingTaskId, toast, loadHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const incoming = Array.from(e.target.files);
    const valid: File[] = [];
    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: `${file.name} is not supported.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `${file.name} exceeds 500MB.`, variant: "destructive" });
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
      setResult(null);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const runAdvisoryAnalysis = async () => {
    if (files.length === 0) {
      toast({ title: "No files selected", description: "Please select at least one medical record.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const uploadedPaths: string[] = [];

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let response: Response;

      if (totalSize > INLINE_UPLOAD_THRESHOLD) {
        // Large file(s): upload directly to Storage first (this is what
        // makes 500MB-class hospital record bundles work — the bytes never
        // pass through the analysis function's request body), then hand
        // the function references to what was uploaded.
        setUploadStatus(`Uploading ${files.length} document(s) — this can take a while for large scans...`);
        const storageRefs: { path: string; fileName: string; fileType: string }[] = [];
        for (const file of files) {
          const path = `${session.user.id}/${crypto.randomUUID()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from(ADVISORY_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          uploadedPaths.push(path);
          storageRefs.push({ path, fileName: file.name, fileType: file.type });
        }
        setUploadStatus(null);

        response = await fetch(`${SUPABASE_FUNCTIONS_URL}/analyze-medical-negligence`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ storageRefs }),
        });
      } else {
        // Small file(s): keep the direct inline path for lower latency.
        const formData = new FormData();
        files.forEach((file, index) => formData.append(`file${index}`, file));
        formData.append("fileCount", files.length.toString());

        response = await fetch(`${SUPABASE_FUNCTIONS_URL}/analyze-medical-negligence`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
      }

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Analysis failed");

      if (data.taskId && data.status === "processing") {
        setPendingTaskId(data.taskId);
        setFiles([]);
        toast({
          title: "Advisory analysis started",
          description: "Reading the records in the background — you can navigate away, results will be saved.",
        });
      }
    } catch (error: any) {
      console.error("Advisory analysis error:", error);
      setLoading(false);
      setUploadStatus(null);
      // Best-effort cleanup: don't leave uploaded originals in Storage if the
      // analysis request itself never got queued.
      if (uploadedPaths.length > 0) {
        supabase.storage.from(ADVISORY_BUCKET).remove(uploadedPaths).catch(() => {});
      }
      toast({
        title: "Analysis failed",
        description: error?.message || "Failed to analyze document(s).",
        variant: "destructive",
      });
    }
  };

  // Full negligence data PDF export (mirrors the report data, not the
  // shorter merit-opinion letter which MeritReportGenerator handles).
  const downloadPDF = (data: any) => {
    if (!data) return;
    const doc = new jsPDF();
    let y = addBrandingToPDF(doc, "Medical Negligence Advisory Report", `File: ${data.fileName || "document"}`);
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxWidth = pageWidth - margin * 2;

    const addText = (text: string, size = 10, bold = false, color: [number, number, number] = [0, 0, 0]) => {
      if (!text) return;
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += size * 0.5;
      });
      y += 3;
    };

    if (data.meritOpinion) {
      addText(
        data.meritOpinion.opinion === "possible_negligence"
          ? "POSSIBLE NEGLIGENCE IDENTIFIED"
          : data.meritOpinion.opinion === "defer"
          ? "ASSESSMENT DEFERRED - INSUFFICIENT INFORMATION"
          : "NO CLEAR NEGLIGENCE IDENTIFIED AT THIS STAGE",
        14,
        true,
      );
      addText(data.meritOpinion.summary, 10);
    }
    if (data.overallSeverity) addText(`Overall Severity: ${data.overallSeverity.toUpperCase()}`, 12, true);
    if (data.documentTypesIdentified?.length) {
      addText("DOCUMENT TYPES IDENTIFIED", 12, true);
      addText(data.documentTypesIdentified.map((t: string) => t.replace(/_/g, " ")).join(", "));
    }
    if (data.factsSummary) {
      addText("SUMMARY OF FACTS", 12, true);
      addText(data.factsSummary);
    }
    if (data.medicalTimeline?.length) {
      addText("CHRONOLOGICAL MEDICAL TIMELINE", 12, true);
      data.medicalTimeline.slice(0, 15).forEach((event: any) => {
        addText(`${event.date || "Unknown date"}: ${event.event}`, 9);
        if (event.linkedNegligence) addText(`   Linked to: ${event.linkedNegligence.replace(/_/g, " ")}`, 9, false, [180, 0, 0]);
      });
    }
    if (data.negligenceByType && Object.keys(data.negligenceByType).length > 0) {
      addText("NEGLIGENCE FINDINGS BY TYPE", 12, true);
      Object.entries(data.negligenceByType).forEach(([type, indicators]: [string, any]) => {
        addText(type.replace(/_/g, " ").toUpperCase(), 10, true);
        indicators.forEach((i: any) => addText(`[${i.severity.toUpperCase()}] ${i.finding} — ${i.evidence}`, 9));
      });
    }
    if (data.expertRecommendations?.length) {
      addText("RECOMMENDED EXPERT REFERRALS", 12, true);
      data.expertRecommendations.forEach((rec: any) => {
        addText(`${rec.expertType} (${rec.priority} priority)`, 10, true);
        addText(rec.reason, 9);
      });
    }
    if (data.disclaimer) addText(data.disclaimer.text, 8, false, [100, 100, 100]);

    addBrandingFooter(doc);
    const fileName = data.fileName?.replace(/\.[^/.]+$/, "") || "advisory_report";
    doc.save(`advisory_report_${fileName}.pdf`);
    toast({ title: "PDF downloaded", description: "Advisory report saved as PDF." });
  };

  const downloadWord = async (data: any) => {
    if (!data) return;
    setDownloadingWord(true);
    try {
      const blob = await buildNegligenceWordReport(data);
      const fileName = data.fileName?.replace(/\.[^/.]+$/, "") || "advisory_report";
      downloadBlob(blob, `advisory_report_${fileName}.docx`);
      toast({ title: "Word document downloaded", description: "Advisory report saved as .docx." });
    } catch (error) {
      console.error("Word export error:", error);
      toast({ title: "Export failed", description: "Could not generate the Word document.", variant: "destructive" });
    } finally {
      setDownloadingWord(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Advisory | Medical Negligence Screening</title>
        <meta
          name="description"
          content="AI-powered advisory tool: reads medical records, including scanned and handwritten notes, and generates a preliminary negligence screening report with expert recommendations."
        />
      </Helmet>
      <DashboardStickyHeader
        title="Advisory"
        subtitle="Upload medical records — including scanned and handwritten notes — for a preliminary negligence screening and expert recommendations."
      />

      <main className="flex-1 container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Run an Advisory Analysis
            </CardTitle>
            <CardDescription>
              Upload clinical notes, hospital records, or scanned/handwritten documents. The system reads them,
              screens for potential negligence, and recommends which experts to appoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                id="advisory-upload"
                onChange={handleFileChange}
                multiple
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.tiff,.bmp,.webp"
                className="hidden"
                disabled={loading}
              />
              <label htmlFor="advisory-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload medical records</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Word, TXT, or scanned/handwritten images (JPG/PNG/TIFF) — up to 500MB each
                </p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{files.length} document(s) selected</p>
                <div className="space-y-1">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded">
                      <span className="truncate">{file.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} disabled={loading}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button onClick={runAdvisoryAnalysis} disabled={loading || files.length === 0} className="gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Scale className="h-4 w-4" /> Analyze {files.length} Document(s)
                    </>
                  )}
                </Button>
              </div>
            )}

            {uploadStatus && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">{uploadStatus}</span>
              </div>
            )}

            {(loading || pendingTaskId) && !uploadStatus && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Reading records — including handwritten notes — and screening for negligence indicators. This can
                  take a few minutes, longer for large or handwritten document sets. You can leave this page; results
                  are saved automatically.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={() => downloadPDF(result)} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={() => downloadWord(result)} variant="outline" className="gap-2" disabled={downloadingWord}>
                {downloadingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download Word
              </Button>
            </div>

            <NegligenceAnalysisResults result={result} />

            {result.meritReportSections && result.meritOpinion && result.disclaimer && (
              <MeritReportGenerator
                sections={result.meritReportSections}
                fileName={result.fileName || "document"}
                meritOpinion={result.meritOpinion}
                disclaimer={result.disclaimer}
              />
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advisory History</CardTitle>
            <CardDescription>Past analyses run on this system.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No advisory analyses yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{record.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {record.status === "completed" ? (
                        <Badge
                          variant={
                            record.overall_severity === "high"
                              ? "destructive"
                              : record.overall_severity === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {record.overall_severity?.toUpperCase()}
                        </Badge>
                      ) : record.status === "failed" ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" /> {record.status}
                        </Badge>
                      )}
                      {record.status === "completed" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryItem(record)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadPDF(record.analysis_result)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {record.status === "failed" && (
                        <span
                          className="text-xs text-muted-foreground flex items-center gap-1"
                          title="Original files aren't stored — re-upload them to try again."
                        >
                          <RefreshCw className="h-3 w-3" /> Re-upload to retry
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedHistoryItem && (
          <Card ref={selectedItemRef}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{selectedHistoryItem.file_name}</CardTitle>
                <CardDescription>
                  Advisory analysis from {new Date(selectedHistoryItem.created_at).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadWord(selectedHistoryItem.analysis_result)}>
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryItem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <NegligenceAnalysisResults result={selectedHistoryItem.analysis_result} />
            </CardContent>
          </Card>
        )}
      </main>

      <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground pb-2">
        <FileText className="h-3 w-3" />
        Internal tool — preliminary screening only, not a substitute for a qualified medical expert's opinion.
      </div>
      <CompanyFooter />
    </div>
  );
};

export default Advisory;

import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Clock, AlertTriangle, Loader2, Activity, UserCheck, RefreshCw, Download, Eye, X, Scale, Shield } from "lucide-react";
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
import { NegligenceAnalysisResults } from "@/components/NegligenceAnalysisResults";
import { MeritReportGenerator } from "@/components/MeritReportGenerator";
import CaseScreeningResults from "@/components/CaseScreeningResults";
import CaseScreeningOpinionReport from "@/components/CaseScreeningOpinionReport";
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
  paragraphIssues?: {
    issue: string;
    location: string;
    suggestion: string;
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
    changesByType?: Record<string, number>;
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
  const [negligenceFiles, setNegligenceFiles] = useState<File[]>([]);
  const [pendingProofreadTaskId, setPendingProofreadTaskId] = useState<string | null>(null);
  const [pendingNegligenceTaskId, setPendingNegligenceTaskId] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [selectedNegligenceHistoryItem, setSelectedNegligenceHistoryItem] = useState<any | null>(null);
  
  // Case Screening state
  const [caseScreeningFiles, setCaseScreeningFiles] = useState<File[]>([]);
  const [caseScreeningClaimantName, setCaseScreeningClaimantName] = useState("");
  const [caseScreeningResult, setCaseScreeningResult] = useState<any | null>(null);
  const [loadingCaseScreening, setLoadingCaseScreening] = useState(false);
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/document-proofreading';

  // Load proofreading history
  const loadHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('proofreading_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
      
      // Check if any tasks are still processing
      const processingTasks = data?.filter(d => d.status === 'processing' || d.status === 'pending') || [];
      if (processingTasks.length > 0 && !pendingProofreadTaskId) {
        setPendingProofreadTaskId(processingTasks[0].id);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, [pendingProofreadTaskId]);

  // Load negligence analysis history
  const loadNegligenceHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('negligence_analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNegligenceHistory(data || []);
      
      // Check if any tasks are still processing
      const processingTasks = data?.filter(d => d.status === 'processing' || d.status === 'pending') || [];
      if (processingTasks.length > 0 && !pendingNegligenceTaskId) {
        setPendingNegligenceTaskId(processingTasks[0].id);
      }
    } catch (error) {
      console.error('Failed to load negligence history:', error);
    }
  }, [pendingNegligenceTaskId]);

  // Poll for proofreading task completion
  useEffect(() => {
    if (!pendingProofreadTaskId) return;
    
    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('proofreading_history')
        .select('*')
        .eq('id', pendingProofreadTaskId)
        .single();
      
      if (error || !data) {
        setPendingProofreadTaskId(null);
        return;
      }
      
      if (data.status === 'completed' && data.result_data) {
        setResult(data.result_data as unknown as ProofreadingResult);
        setPendingProofreadTaskId(null);
        setIsProcessing(false);
        setProgress(100);
        toast({
          title: "Proofreading complete",
          description: `Quality score: ${data.quality_score}%. Found ${data.total_changes} corrections.`,
        });
        loadHistory();
      } else if (data.status === 'failed') {
        setPendingProofreadTaskId(null);
        setIsProcessing(false);
        setProgress(0);
        const errorData = data.result_data as Record<string, unknown> | null;
        toast({
          title: "Proofreading failed",
          description: (errorData?.error as string) || "An error occurred during processing.",
          variant: "destructive",
        });
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [pendingProofreadTaskId, toast, loadHistory]);

  // Poll for negligence analysis task completion
  useEffect(() => {
    if (!pendingNegligenceTaskId) return;
    
    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('negligence_analysis_history')
        .select('*')
        .eq('id', pendingNegligenceTaskId)
        .single();
      
      if (error || !data) {
        setPendingNegligenceTaskId(null);
        return;
      }
      
      if (data.status === 'completed' && data.analysis_result) {
        setNegligenceResult(data.analysis_result);
        setPendingNegligenceTaskId(null);
        setLoadingNegligence(false);
        toast({
          title: "Analysis complete",
          description: `Found ${data.indicator_count} potential negligence indicators.`,
        });
        loadNegligenceHistory();
      } else if (data.status === 'failed') {
        setPendingNegligenceTaskId(null);
        setLoadingNegligence(false);
        const errorData = data.analysis_result as Record<string, unknown> | null;
        toast({
          title: "Analysis failed",
          description: (errorData?.error as string) || "An error occurred during analysis.",
          variant: "destructive",
        });
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [pendingNegligenceTaskId, toast, loadNegligenceHistory]);

  useEffect(() => {
    loadHistory();
    loadNegligenceHistory();
  }, [loadHistory, loadNegligenceHistory]);

  const handleNegligenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      
      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a supported file type.`,
            variant: "destructive",
          });
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 20MB limit.`,
            variant: "destructive",
          });
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        setNegligenceFiles(prev => [...prev, ...validFiles]);
        setNegligenceResult(null);
      }
      
      // Reset input
      e.target.value = '';
    }
  };

  const removeNegligenceFile = (index: number) => {
    setNegligenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleNegligenceAnalysis = async () => {
    if (negligenceFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one document to analyze.",
        variant: "destructive",
      });
      return;
    }

    setLoadingNegligence(true);
    setNegligenceResult(null);

    try {
      const formData = new FormData();
      negligenceFiles.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      formData.append('fileCount', negligenceFiles.length.toString());

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/analyze-medical-negligence`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Handle background task response
      if (data.taskId && data.status === 'processing') {
        setPendingNegligenceTaskId(data.taskId);
        toast({
          title: "Analysis started",
          description: "Processing in background. You can navigate away - results will be saved.",
        });
        // Don't set loading to false - polling will handle completion
      } else if (data.success && data.negligenceIndicators) {
        // Handle immediate response (legacy)
        setNegligenceResult(data);
        setLoadingNegligence(false);
        toast({
          title: "Analysis complete",
          description: `Found ${data.negligenceIndicators.length} potential negligence indicators.`,
        });
        loadNegligenceHistory();
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      setLoadingNegligence(false);
      
      let errorTitle = "Analysis Failed";
      let errorDescription = "Failed to analyze document";
      
      if (error?.message) {
        errorDescription = error.message;
      } else if (typeof error === 'string') {
        errorDescription = error;
      }
      
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
    }
  };

  // Case Screening Handler
  const handleCaseScreening = async () => {
    if (caseScreeningFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one document to screen.",
        variant: "destructive",
      });
      return;
    }

    setLoadingCaseScreening(true);
    setCaseScreeningResult(null);

    try {
      const formData = new FormData();
      caseScreeningFiles.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      formData.append('fileCount', caseScreeningFiles.length.toString());
      if (caseScreeningClaimantName) {
        formData.append('claimantName', caseScreeningClaimantName);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://zybkhhxvsdjkluqydcbb.supabase.co/functions/v1/screen-case-intake`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Case screening failed');
      }

      setCaseScreeningResult(data.result);
      toast({
        title: "Screening complete",
        description: `Analyzed ${caseScreeningFiles.length} document(s). Recommendation: ${data.result.viability?.recommendation?.replace(/_/g, ' ') || 'Pending'}.`,
      });
    } catch (error: any) {
      console.error('Case screening error:', error);
      toast({
        title: "Screening failed",
        description: error.message || "Failed to screen case",
        variant: "destructive",
      });
    } finally {
      setLoadingCaseScreening(false);
    }
  };

  const handleCaseScreeningFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      
      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not a supported file type.`,
            variant: "destructive",
          });
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 20MB limit.`,
            variant: "destructive",
          });
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        setCaseScreeningFiles(prev => [...prev, ...validFiles]);
        setCaseScreeningResult(null);
      }
      
      // Reset input
      e.target.value = '';
    }
  };

  const removeCaseScreeningFile = (index: number) => {
    setCaseScreeningFiles(prev => prev.filter((_, i) => i !== index));
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
    setResult(null);

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

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Handle background task response
      if (data.taskId && data.status === 'processing') {
        setPendingProofreadTaskId(data.taskId);
        setProgress(50);
        toast({
          title: "Proofreading started",
          description: "Processing in background. You can navigate away - results will be saved.",
        });
        // Don't set isProcessing to false - polling will handle completion
      } else if (data.success !== false) {
        // Handle immediate response (legacy)
        setResult(data);
        setProgress(100);
        setIsProcessing(false);

        const successMessage = data.metadata?.compressionApplied
          ? `Large document compressed from ${data.metadata.originalSize} to ${data.metadata.compressedSize}. Quality score: ${data.qualityScore}%.`
          : `Quality score: ${data.qualityScore}%. Found ${data.changes.length} corrections.`;

        toast({
          title: "Proofreading complete",
          description: successMessage,
        });
        
        loadHistory();
      }
    } catch (error) {
      console.error('Proofreading error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to proofread document",
        variant: "destructive",
      });
      setProgress(0);
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
    const startY = addBrandingToPDF(doc, 'Medical Negligence Analysis Report', 'PRELIMINARY MEDICO-LEGAL SCREENING');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = { left: 20, right: 20, top: startY + 10, bottom: 30 };
    const maxLineWidth = pageWidth - margins.left - margins.right;
    let currentY = margins.top;

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
      if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      if (isBold) doc.setFont(undefined, 'bold');
      else doc.setFont(undefined, 'normal');
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      lines.forEach((line: string) => {
        if (currentY > doc.internal.pageSize.getHeight() - margins.bottom) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(line, margins.left, currentY);
        currentY += fontSize * 0.5;
      });
      currentY += 3;
    };

    // Draft notice
    addText('⚠️ DRAFT – SUBJECT TO EXPERT CONFIRMATION', 11, true, [180, 0, 0]);
    currentY += 3;

    // File info
    addText(`File: ${negligenceResult.fileName}`, 9);
    addText(`Generated: ${new Date().toLocaleString()}`, 9);
    currentY += 5;

    // Merit Opinion
    if (negligenceResult.meritOpinion) {
      const opinionColor: [number, number, number] = negligenceResult.meritOpinion.opinion === 'possible_negligence' ? [180, 0, 0] : [0, 100, 0];
      addText(
        negligenceResult.meritOpinion.opinion === 'possible_negligence' 
          ? 'PRELIMINARY OPINION: POSSIBLE NEGLIGENCE IDENTIFIED'
          : 'PRELIMINARY OPINION: NO CLEAR NEGLIGENCE IDENTIFIED',
        12,
        true,
        opinionColor
      );
      addText(`Confidence: ${negligenceResult.meritOpinion.confidence.toUpperCase()}`, 10);
      currentY += 2;
      addText(negligenceResult.meritOpinion.summary, 10);
      currentY += 5;
    }

    // Overall Severity
    addText(`Overall Severity: ${negligenceResult.overallSeverity.toUpperCase()}`, 12, true);
    currentY += 5;

    // Document Types Identified
    if (negligenceResult.documentTypesIdentified && negligenceResult.documentTypesIdentified.length > 0) {
      addText('MEDICAL RECORDS IDENTIFIED', 12, true);
      currentY += 2;
      addText(negligenceResult.documentTypesIdentified.map((t: string) => t.replace(/_/g, ' ')).join(', '));
      currentY += 5;
    }

    // Facts Summary
    if (negligenceResult.factsSummary) {
      addText('SUMMARY OF FACTS', 12, true);
      currentY += 2;
      addText(negligenceResult.factsSummary);
      currentY += 5;
    }

    // Medical Timeline
    if (negligenceResult.medicalTimeline && negligenceResult.medicalTimeline.length > 0) {
      addText('CHRONOLOGICAL MEDICAL TIMELINE', 12, true);
      currentY += 2;
      negligenceResult.medicalTimeline.slice(0, 15).forEach((event: any, idx: number) => {
        addText(`${idx + 1}. ${event.date || 'Unknown'}: ${event.event}`, 10, idx === 0);
        if (event.linkedNegligence) {
          addText(`   ⚠️ Linked to: ${event.linkedNegligence.replace(/_/g, ' ')}`, 9, false, [180, 0, 0]);
        }
      });
      currentY += 5;
    }

    // Negligence Indicators by Type
    if (negligenceResult.negligenceByType && Object.keys(negligenceResult.negligenceByType).length > 0) {
      addText('NEGLIGENCE FINDINGS BY TYPE', 12, true);
      currentY += 2;
      
      Object.entries(negligenceResult.negligenceByType).forEach(([type, indicators]: [string, any]) => {
        addText(`${type.replace(/_/g, ' ').toUpperCase()}`, 11, true, [180, 0, 0]);
        indicators.forEach((indicator: any, idx: number) => {
          addText(`${idx + 1}. ${indicator.finding}`, 10);
          addText(`   Severity: ${indicator.severity} | Evidence: ${indicator.evidence}`, 9);
          if (indicator.recordReference) {
            addText(`   Record: ${indicator.recordReference}`, 9);
          }
          if (indicator.standardOfCareViolated) {
            addText(`   Standard Violated: ${indicator.standardOfCareViolated}`, 9);
          }
          currentY += 2;
        });
        currentY += 3;
      });
    }

    // Expert Recommendations
    if (negligenceResult.expertRecommendations && negligenceResult.expertRecommendations.length > 0) {
      currentY += 5;
      addText('RECOMMENDED EXPERT REFERRALS', 12, true);
      currentY += 2;
      
      negligenceResult.expertRecommendations.forEach((rec: any, idx: number) => {
        addText(`${idx + 1}. ${rec.expertType} (${rec.priority.toUpperCase()} PRIORITY)`, 10, true);
        addText(`Reason: ${rec.reason}`);
        if (rec.linkedNegligenceTypes && rec.linkedNegligenceTypes.length > 0) {
          addText(`Linked to: ${rec.linkedNegligenceTypes.map((t: string) => t.replace(/_/g, ' ')).join(', ')}`, 9);
        }
        if (rec.specificReviewAreas && rec.specificReviewAreas.length > 0) {
          addText(`Review Areas: ${rec.specificReviewAreas.join(', ')}`, 9);
        }
        currentY += 3;
      });
    }

    // Disclaimer
    currentY += 10;
    addText('IMPORTANT DISCLAIMER', 11, true, [180, 0, 0]);
    if (negligenceResult.disclaimer) {
      addText(negligenceResult.disclaimer.text, 8, false, [100, 100, 100]);
    } else {
      addText('This analysis constitutes a preliminary medico-legal screening opinion only and is NOT a final expert opinion. All findings must be confirmed by appropriately qualified medical experts.', 8, false, [100, 100, 100]);
    }
    
    addBrandingFooter(doc);
    
    const fileName = negligenceResult.fileName?.replace(/\.[^/.]+$/, '') || 'negligence_analysis';
    doc.save(`negligence_analysis_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Full negligence analysis report saved as PDF.",
    });
  };

  const downloadFactsSummary = () => {
    if (!negligenceResult?.factsSummary) return;
    
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'Summary of Facts', `File: ${negligenceResult.fileName}`);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = { left: 20, right: 20, top: startY + 10, bottom: 30 };
    const maxLineWidth = pageWidth - margins.left - margins.right;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    const lines = doc.splitTextToSize(negligenceResult.factsSummary, maxLineWidth);
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
    
    const fileName = negligenceResult.fileName?.replace(/\.[^/.]+$/, '') || 'facts_summary';
    doc.save(`facts_summary_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Facts summary saved as PDF.",
    });
  };

  // Download proofreading history result as PDF
  const downloadProofreadingHistoryResult = (record: any) => {
    if (!record.result_data) {
      toast({
        title: "No data available",
        description: "This record does not have result data to download.",
        variant: "destructive",
      });
      return;
    }

    const resultData = record.result_data as ProofreadingResult;
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'Proofreading Report', `File: ${record.file_name}`);
    
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

    // Quality Score
    addText(`Quality Score: ${record.quality_score}%`, 14, true);
    addText(`Total Changes: ${record.total_changes}`, 10);
    addText(`Total Words: ${record.total_words}`, 10);
    addText(`Processing Time: ${record.processing_time}s`, 10);
    currentY += 5;

    // Changes
    if (resultData.changes && resultData.changes.length > 0) {
      addText('CORRECTIONS FOUND', 12, true);
      currentY += 2;
      
      resultData.changes.forEach((change, idx) => {
        addText(`${idx + 1}. ${change.type.replace('_', ' ').toUpperCase()} (Line ${change.line})`, 10, true);
        addText(`Original: ${change.original}`);
        addText(`Corrected: ${change.corrected}`);
        addText(`Reason: ${change.reason}`);
        currentY += 3;
      });
    }

    // Paragraph Issues
    if (resultData.paragraphIssues && resultData.paragraphIssues.length > 0) {
      currentY += 5;
      addText('PARAGRAPH ISSUES', 12, true);
      currentY += 2;
      
      resultData.paragraphIssues.forEach((issue, idx) => {
        addText(`${idx + 1}. ${issue.issue}`, 10, true);
        addText(`Location: ${issue.location}`);
        addText(`Suggestion: ${issue.suggestion}`);
        currentY += 3;
      });
    }
    
    addBrandingFooter(doc);
    
    const fileName = record.file_name?.replace(/\.[^/.]+$/, '') || 'proofreading_report';
    doc.save(`proofreading_report_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Proofreading report saved as PDF.",
    });
  };

  // Download negligence history result as PDF
  const downloadNegligenceHistoryResult = (record: any) => {
    if (!record.analysis_result) {
      toast({
        title: "No data available",
        description: "This record does not have analysis data to download.",
        variant: "destructive",
      });
      return;
    }

    const analysisResult = record.analysis_result;
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'Medical Negligence Analysis Report', `File: ${record.file_name}`);
    
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
    addText(`Overall Severity: ${record.overall_severity.toUpperCase()}`, 14, true);
    addText(`Indicators Found: ${record.indicator_count}`, 10);
    addText(`Evidence Items: ${record.evidence_count}`, 10);
    addText(`Recommendations: ${record.recommendation_count}`, 10);
    currentY += 5;

    // Facts Summary
    if (analysisResult.factsSummary) {
      addText('SUMMARY OF FACTS', 12, true);
      currentY += 2;
      addText(analysisResult.factsSummary);
      currentY += 5;
    }

    // Negligence Indicators
    if (analysisResult.negligenceIndicators && analysisResult.negligenceIndicators.length > 0) {
      addText('NEGLIGENCE INDICATORS', 12, true);
      currentY += 2;
      
      analysisResult.negligenceIndicators.forEach((indicator: any, idx: number) => {
        addText(`${idx + 1}. ${indicator.category.replace(/_/g, ' ').toUpperCase()}`, 10, true);
        addText(`Finding: ${indicator.finding}`);
        addText(`Severity: ${indicator.severity}`);
        addText(`Evidence: ${indicator.evidence}`);
        currentY += 3;
      });
    }

    // Expert Recommendations
    if (analysisResult.expertRecommendations && analysisResult.expertRecommendations.length > 0) {
      currentY += 5;
      addText('RECOMMENDED EXPERTS', 12, true);
      currentY += 2;
      
      analysisResult.expertRecommendations.forEach((rec: any, idx: number) => {
        addText(`${idx + 1}. ${rec.expertType}`, 10, true);
        addText(`Priority: ${rec.priority}`);
        addText(`Reason: ${rec.reason}`);
        currentY += 3;
      });
    }
    
    addBrandingFooter(doc);
    
    const fileName = record.file_name?.replace(/\.[^/.]+$/, '') || 'negligence_report';
    doc.save(`negligence_report_${fileName}.pdf`);
    
    toast({
      title: "PDF downloaded",
      description: "Negligence analysis report saved as PDF.",
    });
  };

  // View proofreading history result
  const viewProofreadingHistoryResult = (record: any) => {
    if (!record.result_data) {
      toast({
        title: "No data available",
        description: "This record does not have result data to view.",
        variant: "destructive",
      });
      return;
    }
    setSelectedHistoryItem(record);
  };

  // View negligence history result  
  const viewNegligenceHistoryResult = (record: any) => {
    if (!record.analysis_result) {
      toast({
        title: "No data available",
        description: "This record does not have analysis data to view.",
        variant: "destructive",
      });
      return;
    }
    setSelectedNegligenceHistoryItem(record);
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
                          <div className="flex items-center gap-2">
                            <Badge variant={record.quality_score >= 90 ? "default" : record.quality_score >= 70 ? "secondary" : "destructive"}>
                              {record.quality_score}%
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
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
                          <div className="mb-3 flex items-center gap-2 text-xs text-blue-600">
                            <CheckCircle className="h-3 w-3" />
                            Compression applied: {record.original_size} → {record.compressed_size}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => viewProofreadingHistoryResult(record)}
                            disabled={!record.result_data || record.status === 'processing'}
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => downloadProofreadingHistoryResult(record)}
                            disabled={!record.result_data || record.status === 'processing'}
                            className="gap-1"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                          {record.status === 'processing' && (
                            <Badge variant="secondary" className="ml-auto">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
                        </div>
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
                        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
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
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => viewNegligenceHistoryResult(record)}
                            disabled={!record.analysis_result || record.status === 'processing'}
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => downloadNegligenceHistoryResult(record)}
                            disabled={!record.analysis_result || record.status === 'processing'}
                            className="gap-1"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                          {record.status === 'processing' && (
                            <Badge variant="secondary" className="ml-auto">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="proofread">Proofread Document</TabsTrigger>
              <TabsTrigger value="negligence">Negligence Analysis</TabsTrigger>
              <TabsTrigger value="screening">Case Screening</TabsTrigger>
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
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="document">
                          Document ({result.changes.length} errors)
                        </TabsTrigger>
                        <TabsTrigger value="changes">
                          Changes List
                        </TabsTrigger>
                        <TabsTrigger value="paragraphs">
                          Paragraph Issues ({result.paragraphIssues?.length || 0})
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
                        <div className="flex justify-between items-center mb-4">
                          {result.metadata.changesByType && Object.keys(result.metadata.changesByType).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(result.metadata.changesByType).map(([type, count]) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type}: {count}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                                  <Badge variant="outline">{change.type.replace('_', ' ')}</Badge>
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

                      <TabsContent value="paragraphs" className="space-y-4 mt-4">
                        {(!result.paragraphIssues || result.paragraphIssues.length === 0) ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                            <p>No paragraph structure issues found!</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            <div className="p-3 bg-muted rounded-lg mb-4">
                              <p className="text-sm text-muted-foreground">
                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                These are suggestions only - they do not change medical content.
                              </p>
                            </div>
                            {result.paragraphIssues.map((issue, idx) => (
                              <div key={idx} className="p-4 border rounded-lg border-cyan-300">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700">
                                    {issue.issue.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Location: {issue.location}</p>
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium text-cyan-700">Suggestion:</span> {issue.suggestion}
                                  </p>
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
                      onChange={handleNegligenceFileChange}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      disabled={loadingNegligence}
                      multiple
                    />
                    <label htmlFor="negligence-upload" className="cursor-pointer">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Click to add medical/clinical records
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, Word, Text files (Max 20MB each) - Multiple files supported
                      </p>
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {negligenceFiles.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">{negligenceFiles.length} document(s) selected</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {negligenceFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNegligenceFile(index)}
                              disabled={loadingNegligence}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={handleNegligenceAnalysis}
                        disabled={loadingNegligence || negligenceFiles.length === 0}
                        className="w-full"
                      >
                        {loadingNegligence ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Activity className="h-4 w-4 mr-2" />
                            Analyze {negligenceFiles.length} Document(s)
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {loadingNegligence && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-muted-foreground">Analyzing documents for negligence indicators...</span>
                      </div>
                      <div className="text-center text-xs text-muted-foreground">
                        This may take 30-60 seconds for large documents
                      </div>
                    </div>
                  )}

                  {negligenceResult && (
                    <div className="space-y-6">
                      {/* Download Buttons */}
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={downloadNegligenceReport} variant="outline" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Download Full Report
                        </Button>
                        {negligenceResult.factsSummary && (
                          <Button onClick={downloadFactsSummary} variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Facts Summary
                          </Button>
                        )}
                      </div>

                      {/* Enhanced Analysis Results Component */}
                      <NegligenceAnalysisResults result={negligenceResult} />

                      {/* Merit Report Generator - Draft/Editable */}
                      {negligenceResult.meritReportSections && negligenceResult.meritOpinion && negligenceResult.disclaimer && (
                        <MeritReportGenerator
                          sections={negligenceResult.meritReportSections}
                          fileName={negligenceResult.fileName || 'document'}
                          meritOpinion={negligenceResult.meritOpinion}
                          disclaimer={negligenceResult.disclaimer}
                        />
                      )}

                      {/* Analysis Metadata */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Analysis Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Processing Time</p>
                              <p className="font-medium">{negligenceResult.metadata?.processingTime || 0}s</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Document Length</p>
                              <p className="font-medium">{(negligenceResult.metadata?.documentLength || 0).toLocaleString()} chars</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Chunks Processed</p>
                              <p className="font-medium">{negligenceResult.metadata?.chunksProcessed || 0}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Timeline Events</p>
                              <p className="font-medium">{negligenceResult.metadata?.timelineEventCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Document Types</p>
                              <p className="font-medium">{negligenceResult.metadata?.documentTypesCount || 0}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Disclaimer Footer */}
                      {negligenceResult.disclaimer && (
                        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700">
                          <CardContent className="pt-6">
                            <div className="flex gap-3">
                              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                              <div>
                                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Important Disclaimer</p>
                                <p className="text-sm text-amber-700 dark:text-amber-300">{negligenceResult.disclaimer.text}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Case Screening Tab */}
            <TabsContent value="screening" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Case Intake Screening</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Screen Road Accident (RAF), Slip and Fall, and Unlawful Arrest cases. Upload medical records, police reports, or case documents.
                  </p>
                  
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="claimant-name">Claimant Name (Optional)</Label>
                      <Input
                        id="claimant-name"
                        placeholder="Enter claimant name for conflict check"
                        value={caseScreeningClaimantName}
                        onChange={(e) => setCaseScreeningClaimantName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <input
                        type="file"
                        id="screening-upload"
                        onChange={handleCaseScreeningFileChange}
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        disabled={loadingCaseScreening}
                        multiple
                      />
                      <label htmlFor="screening-upload" className="cursor-pointer">
                        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Click to add medical records, police reports, hospital notes
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF, Word, Text files (Max 20MB each) - Multiple files supported
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {caseScreeningFiles.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">{caseScreeningFiles.length} document(s) selected</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {caseScreeningFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium truncate max-w-[200px] md:max-w-[400px]">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeCaseScreeningFile(index)}
                              disabled={loadingCaseScreening}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button 
                        onClick={handleCaseScreening} 
                        disabled={loadingCaseScreening}
                        className="w-full"
                      >
                        {loadingCaseScreening ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Screening {caseScreeningFiles.length} document(s)...
                          </>
                        ) : (
                          `Screen Case (${caseScreeningFiles.length} documents)`
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Case Screening Results */}
              {caseScreeningResult && (
                <div className="space-y-6">
                  <CaseScreeningResults result={caseScreeningResult} />
                  <CaseScreeningOpinionReport 
                    result={caseScreeningResult} 
                    claimantName={caseScreeningClaimantName || undefined}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Proofreading History Result Modal */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {selectedHistoryItem.file_name}
                  </CardTitle>
                  <CardDescription>
                    Proofreading result from {new Date(selectedHistoryItem.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadProofreadingHistoryResult(selectedHistoryItem)}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedHistoryItem(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Quality Score */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Quality Score</p>
                  <p className="text-3xl font-bold">{selectedHistoryItem.quality_score}%</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Changes</p>
                    <p className="text-xl font-semibold">{selectedHistoryItem.total_changes}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Words</p>
                    <p className="text-xl font-semibold">{selectedHistoryItem.total_words}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="text-xl font-semibold">{selectedHistoryItem.processing_time}s</p>
                  </div>
                </div>
              </div>

              {/* Changes List */}
              {selectedHistoryItem.result_data?.changes?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Corrections Found ({selectedHistoryItem.result_data.changes.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedHistoryItem.result_data.changes.map((change: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{change.type}</Badge>
                          <span className="text-xs text-muted-foreground">Line {change.line}</span>
                        </div>
                        <p>
                          <span className="text-red-600 line-through">{change.original}</span>
                          {" → "}
                          <span className="text-green-600 font-medium">{change.corrected}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{change.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paragraph Issues */}
              {selectedHistoryItem.result_data?.paragraphIssues?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Paragraph Issues ({selectedHistoryItem.result_data.paragraphIssues.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedHistoryItem.result_data.paragraphIssues.map((issue: any, idx: number) => (
                      <div key={idx} className="p-3 border border-cyan-200 rounded-lg text-sm">
                        <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 mb-2">{issue.issue}</Badge>
                        <p className="font-medium">Location: {issue.location}</p>
                        <p className="text-muted-foreground">{issue.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedHistoryItem.result_data?.changes?.length === 0 && !selectedHistoryItem.result_data?.paragraphIssues?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>No corrections needed! Document was in excellent condition.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Negligence History Result Modal */}
      {selectedNegligenceHistoryItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="flex-shrink-0 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    {selectedNegligenceHistoryItem.file_name}
                  </CardTitle>
                  <CardDescription>
                    Negligence analysis from {new Date(selectedNegligenceHistoryItem.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedNegligenceHistoryItem.overall_severity === 'high' ? "destructive" : selectedNegligenceHistoryItem.overall_severity === 'medium' ? "default" : "secondary"}>
                    {selectedNegligenceHistoryItem.overall_severity?.toUpperCase()} SEVERITY
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadNegligenceHistoryResult(selectedNegligenceHistoryItem)}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedNegligenceHistoryItem(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedNegligenceHistoryItem.indicator_count}</p>
                  <p className="text-xs text-muted-foreground">Indicators</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedNegligenceHistoryItem.evidence_count}</p>
                  <p className="text-xs text-muted-foreground">Evidence</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">{selectedNegligenceHistoryItem.recommendation_count}</p>
                  <p className="text-xs text-muted-foreground">Experts</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedNegligenceHistoryItem.processing_time}s</p>
                  <p className="text-xs text-muted-foreground">Time</p>
                </div>
              </div>

              {/* Facts Summary */}
              {selectedNegligenceHistoryItem.analysis_result?.factsSummary && (
                <div>
                  <h4 className="font-semibold mb-2">Summary of Facts</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted rounded-lg">
                    {selectedNegligenceHistoryItem.analysis_result.factsSummary}
                  </p>
                </div>
              )}

              {/* Negligence Indicators */}
              {selectedNegligenceHistoryItem.analysis_result?.negligenceIndicators?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Negligence Indicators</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedNegligenceHistoryItem.analysis_result.negligenceIndicators.map((indicator: any, idx: number) => (
                      <div key={idx} className="p-3 border-l-4 border rounded-r-lg" style={{
                        borderLeftColor: indicator.severity === 'high' ? 'hsl(var(--destructive))' :
                                        indicator.severity === 'medium' ? 'hsl(210 100% 50%)' : 'hsl(var(--muted))'
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={indicator.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {indicator.category?.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{indicator.severity}</Badge>
                        </div>
                        <p className="text-sm font-medium">{indicator.finding}</p>
                        <p className="text-xs text-muted-foreground mt-1">{indicator.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expert Recommendations */}
              {selectedNegligenceHistoryItem.analysis_result?.expertRecommendations?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Recommended Experts</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedNegligenceHistoryItem.analysis_result.expertRecommendations
                      .filter((rec: any) => rec.priority === 'high' || rec.priority === 'medium')
                      .map((rec: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <p className="font-medium text-sm">{rec.expertType}</p>
                          <Badge variant="outline" className="text-xs mb-1">{rec.priority}</Badge>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <CompanyFooter />
    </div>
  );
};

export default DocumentProofreading;

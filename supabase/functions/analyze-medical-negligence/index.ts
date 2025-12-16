import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Negligence type categories as per legal requirements
const NEGLIGENCE_TYPES = [
  'delayed_diagnosis',
  'failure_to_diagnose',
  'incorrect_diagnosis',
  'surgical_negligence',
  'anaesthetic_negligence',
  'medication_error',
  'failure_to_monitor',
  'failure_to_refer',
  'poor_post_operative_care',
  'birth_related_negligence',
  'nursing_negligence',
  'system_hospital_negligence'
] as const;

type NegligenceType = typeof NEGLIGENCE_TYPES[number];

interface NegligenceIndicator {
  category: NegligenceType;
  finding: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
  recordReference: string;
  dateOfEvent: string | null;
  standardOfCareViolated: string;
}

interface TimelineEvent {
  date: string;
  documentType: string;
  event: string;
  significance: string;
  linkedNegligence: string | null;
}

interface KeyEvidence {
  type: string;
  date: string | null;
  description: string;
  relevance: string;
  documentSource: string;
}

interface ExpertRecommendation {
  expertType: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  linkedNegligenceTypes: NegligenceType[];
  specificReviewAreas: string[];
}

interface MeritOpinion {
  opinion: 'possible_negligence' | 'no_clear_negligence';
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  keyFactors: string[];
}

interface MeritReportSections {
  backgroundAndHistory: string;
  summaryOfTreatment: string;
  timelineOfEvents: string;
  riskIndicators: string;
  negligenceOpinion: string;
  negligenceTypes: string;
  recommendedExperts: string;
  conclusion: string;
}

// Helper function to extract text from PDF using DocuPipe OCR
async function extractTextWithOCR(base64Data: string, fileName: string): Promise<string> {
  const DOCUPIPE_API_KEY = Deno.env.get('DOCUPIPE_API_KEY');
  if (!DOCUPIPE_API_KEY) {
    throw new Error('DOCUPIPE_API_KEY is not configured');
  }

  console.log('Using DocuPipe OCR for scanned document...');

  try {
    const formData = new FormData();
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    
    formData.append('file', blob, fileName);

    const response = await fetch('https://api.docupipe.com/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + DOCUPIPE_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('DocuPipe API error: ' + response.status + ' ' + response.statusText);
    }

    const result = await response.json();
    
    if (result.text) {
      console.log('OCR extraction successful, text length:', result.text.length);
      return result.text;
    } else if (result.pages && Array.isArray(result.pages)) {
      const fullText = result.pages.map((page: any) => page.text || '').join('\n\n');
      console.log('OCR extraction successful from pages, text length:', fullText.length);
      return fullText;
    } else {
      throw new Error('DocuPipe returned no extractable text');
    }
  } catch (error) {
    console.error('DocuPipe OCR error:', error);
    throw new Error('OCR extraction failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Helper function to extract text from PDF
async function extractTextFromPDF(data: Uint8Array): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. The file may be corrupted or scanned.');
  }
}

// Helper function to chunk text for processing
function chunkText(text: string, maxChunkSize: number = 15000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text.substring(0, maxChunkSize)];
}

// Helper function to extract text from a single document
async function extractTextFromDocument(fileData: string, fileName: string, fileType: string): Promise<string> {
  const decodedData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
  let extractedText = '';

  if (fileType === 'text/plain') {
    extractedText = new TextDecoder().decode(decodedData);
  } else if (fileType === 'application/pdf') {
    console.log(`Extracting text from PDF: ${fileName}...`);
    extractedText = await extractTextFromPDF(decodedData);
    
    if (!extractedText || extractedText.trim().length < 100) {
      console.log('PDF appears to be scanned. Using OCR...');
      extractedText = await extractTextWithOCR(fileData, fileName);
    }
  } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    extractedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedData);
    extractedText = extractedText.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  }

  return extractedText;
}

// Background processing function
async function processNegligenceAnalysis(
  taskId: string,
  filesData: { fileData: string; fileName: string; fileType: string }[],
  combinedFileName: string,
  userId: string
) {
  const startTime = Date.now();
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    console.log('Background processing started for task:', taskId);
    
    // Update status to processing
    await supabaseAdmin.from('negligence_analysis_history').update({
      status: 'processing'
    }).eq('id', taskId);

    // Extract text from all files and combine
    let extractedText = '';
    for (const file of filesData) {
      const text = await extractTextFromDocument(file.fileData, file.fileName, file.fileType);
      if (text) {
        extractedText += `\n\n--- Document: ${file.fileName} ---\n\n${text}`;
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Could not extract text from documents');
    }

    console.log('Extracted text length:', extractedText.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const chunks = chunkText(extractedText, 15000);
    console.log(`Analyzing ${chunks.length} chunk(s)...`);

    let allIndicators: NegligenceIndicator[] = [];
    let allEvidence: KeyEvidence[] = [];
    let allRecommendations: ExpertRecommendation[] = [];
    let allTimeline: TimelineEvent[] = [];
    let allDocumentTypes: string[] = [];
    let backgroundInfo = '';
    let treatmentSummary = '';

    const BATCH_SIZE = 2;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
      
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const chunkIdx = batchStart + batchIdx;
          
          const analysisPrompt = `You are a senior medico-legal expert analyzing clinical records for potential medical negligence. Your analysis must be thorough, objective, and legally defensible.

DOCUMENT SECTION ${chunkIdx + 1}/${chunks.length}:
${chunk}

INSTRUCTIONS:
1. First, identify the types of medical documents present (clinical notes, nursing notes, operation reports, medication charts, referral letters, discharge summaries, radiology reports, pathology reports, etc.)
2. Extract all events with dates to build a chronological timeline
3. Identify potential negligence indicators using ONLY these specific categories:
   - delayed_diagnosis: Unreasonable delay in reaching correct diagnosis
   - failure_to_diagnose: Complete failure to diagnose a condition
   - incorrect_diagnosis: Wrong diagnosis made
   - surgical_negligence: Errors during surgical procedures
   - anaesthetic_negligence: Errors in anaesthesia administration/monitoring
   - medication_error: Wrong medication, dosage, or administration
   - failure_to_monitor: Inadequate patient monitoring
   - failure_to_refer: Failure to refer to specialist when indicated
   - poor_post_operative_care: Substandard care after surgery
   - birth_related_negligence: Negligence during pregnancy/delivery
   - nursing_negligence: Nursing care below standard
   - system_hospital_negligence: System failures, inadequate resources, protocol failures

4. For each finding, cite specific record references and dates
5. Identify which medical experts would be needed to review each finding

Return ONLY valid JSON (no markdown, no code blocks):
{
  "documentTypesIdentified": ["clinical_notes", "nursing_notes", "operation_report", etc.],
  "backgroundInfo": "Brief patient background, presenting complaints, and relevant history from this section",
  "treatmentSummary": "Summary of medical treatment described in this section",
  "timelineEvents": [
    {
      "date": "YYYY-MM-DD or approximate",
      "documentType": "type of record this came from",
      "event": "what happened",
      "significance": "clinical significance",
      "linkedNegligence": "negligence category if relevant, or null"
    }
  ],
  "negligenceIndicators": [
    {
      "category": "one of the 12 categories above",
      "finding": "detailed description of the finding",
      "severity": "low|medium|high",
      "evidence": "specific evidence supporting this finding",
      "recordReference": "which document/page/note this came from",
      "dateOfEvent": "YYYY-MM-DD or null",
      "standardOfCareViolated": "what standard of care was breached"
    }
  ],
  "keyEvidence": [
    {
      "type": "procedure|medication|diagnosis|test|consultation|vital_sign|complication",
      "date": "YYYY-MM-DD or null",
      "description": "what was documented",
      "relevance": "why this is significant for negligence assessment",
      "documentSource": "which type of document this came from"
    }
  ],
  "expertRecommendations": [
    {
      "expertType": "Orthopaedic Surgeon|Neurosurgeon|Obstetrician & Gynaecologist|Paediatric Neurologist|General Surgeon|Anaesthetist|Emergency Medicine Specialist|Nursing Expert|Occupational Therapist|Industrial Psychologist|Clinical Psychologist|Radiologist|Cardiologist|Other",
      "reason": "specific reason why this expert is needed",
      "priority": "medium|high",
      "linkedNegligenceTypes": ["categories this expert would address"],
      "specificReviewAreas": ["specific aspects this expert should review"]
    }
  ]
}

Be thorough but accurate. Only identify negligence where there is clear evidence of breach of duty. Return empty arrays if no negligence found.`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + LOVABLE_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{ role: 'user', content: analysisPrompt }],
              temperature: 0.1,
            }),
          });

          if (!aiResponse.ok) {
            throw new Error('AI processing failed: ' + aiResponse.status);
          }

          const aiData = await aiResponse.json();
          let content = aiData.choices[0].message.content;
          
          content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) content = jsonMatch[0];
          
          try {
            return JSON.parse(content);
          } catch {
            console.error('JSON parse error for chunk ' + chunkIdx);
            return { 
              negligenceIndicators: [], 
              keyEvidence: [], 
              expertRecommendations: [],
              timelineEvents: [],
              documentTypesIdentified: []
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.negligenceIndicators) allIndicators.push(...result.negligenceIndicators);
        if (result.keyEvidence) allEvidence.push(...result.keyEvidence);
        if (result.expertRecommendations) allRecommendations.push(...result.expertRecommendations);
        if (result.timelineEvents) allTimeline.push(...result.timelineEvents);
        if (result.documentTypesIdentified) allDocumentTypes.push(...result.documentTypesIdentified);
        if (result.backgroundInfo) backgroundInfo += (backgroundInfo ? '\n\n' : '') + result.backgroundInfo;
        if (result.treatmentSummary) treatmentSummary += (treatmentSummary ? '\n\n' : '') + result.treatmentSummary;
      }
      
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log('Analysis complete. Found ' + allIndicators.length + ' indicators');

    // Sort timeline chronologically
    allTimeline.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Deduplicate document types
    const uniqueDocTypes = [...new Set(allDocumentTypes)];

    // Determine merit opinion
    const highSeverityCount = allIndicators.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = allIndicators.filter(i => i.severity === 'medium').length;
    
    let meritOpinion: MeritOpinion;
    let overallSeverity: 'low' | 'medium' | 'high' = 'low';
    
    if (highSeverityCount > 0 || mediumSeverityCount >= 2) {
      overallSeverity = 'high';
      meritOpinion = {
        opinion: 'possible_negligence',
        confidence: highSeverityCount >= 2 ? 'high' : 'medium',
        summary: `Analysis has identified ${allIndicators.length} potential negligence indicator(s), including ${highSeverityCount} high-severity and ${mediumSeverityCount} medium-severity findings that warrant further expert review.`,
        keyFactors: allIndicators
          .filter(i => i.severity === 'high' || i.severity === 'medium')
          .map(i => i.finding)
          .slice(0, 5)
      };
    } else if (mediumSeverityCount === 1 || allIndicators.length > 2) {
      overallSeverity = 'medium';
      meritOpinion = {
        opinion: 'possible_negligence',
        confidence: 'low',
        summary: `Analysis has identified ${allIndicators.length} potential concern(s) that may indicate negligence. Further expert review is recommended to confirm findings.`,
        keyFactors: allIndicators.map(i => i.finding).slice(0, 5)
      };
    } else {
      meritOpinion = {
        opinion: 'no_clear_negligence',
        confidence: allIndicators.length === 0 ? 'high' : 'medium',
        summary: allIndicators.length === 0 
          ? 'Based on the available records, no clear indicators of medical negligence have been identified at this stage.'
          : 'While some areas of concern have been noted, there is insufficient evidence to support a finding of negligence based on the available records.',
        keyFactors: allIndicators.length > 0 ? allIndicators.map(i => i.finding) : ['No significant breaches of standard of care identified']
      };
    }

    // Group negligence by type
    const negligenceByType: Record<NegligenceType, NegligenceIndicator[]> = {} as any;
    for (const indicator of allIndicators) {
      if (!negligenceByType[indicator.category as NegligenceType]) {
        negligenceByType[indicator.category as NegligenceType] = [];
      }
      negligenceByType[indicator.category as NegligenceType].push(indicator);
    }

    // Filter and deduplicate expert recommendations
    const importantRecommendations = allRecommendations.filter(r => r.priority === 'high' || r.priority === 'medium');
    const uniqueRecommendations = Array.from(
      new Map(importantRecommendations.map(r => [r.expertType, r])).values()
    ).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    // Generate merit report sections
    const meritReportSections: MeritReportSections = {
      backgroundAndHistory: backgroundInfo || 'Background information extracted from medical records.',
      summaryOfTreatment: treatmentSummary || 'Summary of medical treatment documented in records.',
      timelineOfEvents: allTimeline.length > 0 
        ? allTimeline.map(t => `${t.date || 'Unknown date'}: ${t.event}`).join('\n')
        : 'Timeline to be compiled from medical records.',
      riskIndicators: allIndicators.length > 0
        ? allIndicators.map(i => `• ${i.category.replace(/_/g, ' ')}: ${i.finding}`).join('\n')
        : 'No significant risk indicators identified.',
      negligenceOpinion: meritOpinion.summary,
      negligenceTypes: Object.keys(negligenceByType).length > 0
        ? Object.entries(negligenceByType).map(([type, indicators]) => 
            `${type.replace(/_/g, ' ').toUpperCase()}:\n${indicators.map(i => `  - ${i.finding}`).join('\n')}`
          ).join('\n\n')
        : 'No specific negligence types identified.',
      recommendedExperts: uniqueRecommendations.length > 0
        ? uniqueRecommendations.map(r => `• ${r.expertType}: ${r.reason}`).join('\n')
        : 'No expert referrals recommended at this stage.',
      conclusion: `This is a preliminary medico-legal screening opinion based on the available medical records. ${meritOpinion.summary} Final determination of negligence must be made by appropriately qualified medical experts.`
    };

    // Combine facts summaries
    const factsSummary = [
      backgroundInfo,
      treatmentSummary,
      meritOpinion.summary
    ].filter(Boolean).join('\n\n').substring(0, 3000) || 'No detailed facts summary available for this document.';

    const result = {
      success: true,
      fileName,
      overallSeverity,
      meritOpinion,
      factsSummary,
      documentTypesIdentified: uniqueDocTypes,
      medicalTimeline: allTimeline.slice(0, 50),
      negligenceIndicators: allIndicators,
      negligenceByType,
      keyEvidence: allEvidence.slice(0, 30),
      expertRecommendations: uniqueRecommendations,
      meritReportSections,
      disclaimer: {
        text: "IMPORTANT DISCLAIMER: This analysis constitutes a preliminary medico-legal screening opinion only and is NOT a final expert opinion. This system does not replace the assessment of a registered medical expert. All findings must be confirmed by appropriately qualified medical experts before any legal conclusions are drawn. The final medico-legal opinion must be deferred to appointed experts.",
        isDraft: true,
        requiresExpertConfirmation: true
      },
      metadata: {
        documentLength: extractedText.length,
        chunksProcessed: chunks.length,
        processingTime,
        indicatorCount: allIndicators.length,
        evidenceCount: allEvidence.length,
        recommendationCount: uniqueRecommendations.length,
        timelineEventCount: allTimeline.length,
        documentTypesCount: uniqueDocTypes.length
      }
    };

    // Update with completed status and results
    await supabaseAdmin.from('negligence_analysis_history').update({
      status: 'completed',
      overall_severity: overallSeverity,
      indicator_count: allIndicators.length,
      evidence_count: allEvidence.length,
      recommendation_count: uniqueRecommendations.length,
      processing_time: processingTime,
      analysis_result: result
    }).eq('id', taskId);

    console.log('Background task completed for:', taskId);

  } catch (error) {
    console.error('Background processing error:', error);
    await supabaseAdmin.from('negligence_analysis_history').update({
      status: 'failed',
      analysis_result: { error: error instanceof Error ? error.message : 'Unknown error' }
    }).eq('id', taskId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let filesData: { fileData: string; fileName: string; fileType: string }[] = [];
    let combinedFileName = '';

    // Check if this is FormData (multiple files) or JSON (single file - legacy)
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with multiple files
      const formData = await req.formData();
      const fileCount = parseInt(formData.get('fileCount') as string) || 0;
      
      console.log(`Received FormData with ${fileCount} file(s)`);
      
      const fileNames: string[] = [];
      
      for (let i = 0; i < fileCount; i++) {
        const file = formData.get(`file${i}`) as File;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          filesData.push({
            fileData: base64Data,
            fileName: file.name,
            fileType: file.type
          });
          fileNames.push(file.name);
          console.log(`Processed file ${i + 1}: ${file.name} (${file.type})`);
        }
      }
      
      combinedFileName = fileNames.join(', ');
    } else {
      // Handle JSON with single file (legacy support)
      const { fileData, fileName, fileType } = await req.json();
      
      if (!fileData) {
        throw new Error('No file data provided');
      }
      
      filesData.push({ fileData, fileName, fileType });
      combinedFileName = fileName;
      console.log('Processing single document:', fileName, 'Type:', fileType);
    }

    if (filesData.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${filesData.length} medical document(s): ${combinedFileName}`);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Extract token - handle both "Bearer token" and just "token" formats
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    console.log('Validating user token...');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error('Auth error:', userError.message);
      throw new Error('Invalid authorization: ' + userError.message);
    }
    
    if (!userData?.user) {
      console.error('No user data returned');
      throw new Error('Invalid authorization: no user found');
    }

    const userId = userData.user.id;
    console.log('User authenticated:', userId);

    // Calculate total file size
    const totalFileSize = filesData.reduce((sum, f) => sum + f.fileData.length, 0);

    // Create initial task record
    const { data: taskData, error: insertError } = await supabaseAdmin
      .from('negligence_analysis_history')
      .insert({
        user_id: userId,
        file_name: combinedFileName,
        file_type: filesData.length > 1 ? 'multiple' : filesData[0].fileType,
        file_size: totalFileSize,
        overall_severity: 'low',
        indicator_count: 0,
        evidence_count: 0,
        recommendation_count: 0,
        processing_time: 0,
        status: 'pending',
        analysis_result: {}
      })
      .select('id')
      .single();

    if (insertError || !taskData) {
      throw new Error('Failed to create task: ' + insertError?.message);
    }

    const taskId = taskData.id;
    console.log('Created background task:', taskId);

    // Start background processing
    EdgeRuntime.waitUntil(processNegligenceAnalysis(taskId, filesData, combinedFileName, userId));

    // Return immediately with task ID
    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      status: 'processing',
      message: `Analysis of ${filesData.length} document(s) started. You can navigate away - results will be saved automatically.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-medical-negligence function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

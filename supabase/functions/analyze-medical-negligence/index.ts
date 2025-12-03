import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NegligenceIndicator {
  category: string;
  finding: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
}

interface KeyEvidence {
  type: string;
  date: string | null;
  description: string;
  relevance: string;
}

interface ExpertRecommendation {
  expertType: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
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

// Background processing function
async function processNegligenceAnalysis(
  taskId: string,
  fileData: string,
  fileName: string,
  fileType: string,
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

    // Decode base64 file data
    const decodedData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    
    let extractedText = '';

    // Extract text based on file type
    if (fileType === 'text/plain') {
      extractedText = new TextDecoder().decode(decodedData);
    } else if (fileType === 'application/pdf') {
      console.log('Extracting text from PDF...');
      extractedText = await extractTextFromPDF(decodedData);
      
      if (!extractedText || extractedText.trim().length < 100) {
        console.log('PDF appears to be scanned. Using OCR...');
        extractedText = await extractTextWithOCR(fileData, fileName);
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedData);
      extractedText = extractedText.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Could not extract text from document');
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

    const BATCH_SIZE = 2;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
      
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const chunkIdx = batchStart + batchIdx;
          
          const analysisPrompt = `You are a medical-legal expert analyzing clinical records for potential negligence.

DOCUMENT SECTION ${chunkIdx + 1}/${chunks.length}:
${chunk}

Analyze for negligence indicators and return ONLY valid JSON (no markdown, no code blocks):
{
  "negligenceIndicators": [
    {
      "category": "diagnostic_error|treatment_delay|medication_error|consent_issue|documentation_failure|communication_breakdown|surgical_complication|monitoring_failure|discharge_planning_error|follow_up_failure",
      "finding": "description",
      "severity": "low|medium|high",
      "evidence": "supporting evidence"
    }
  ],
  "keyEvidence": [
    {
      "type": "procedure|medication|diagnosis|test|consultation|event",
      "date": "YYYY-MM-DD or null",
      "description": "what happened",
      "relevance": "why this matters"
    }
  ],
  "expertRecommendations": [
    {
      "expertType": "medical specialty",
      "reason": "justification",
      "priority": "low|medium|high"
    }
  ]
}

Return empty arrays if no negligence found. ONLY return valid JSON.`;

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
            return { negligenceIndicators: [], keyEvidence: [], expertRecommendations: [] };
          }
        })
      );

      for (const result of batchResults) {
        if (result.negligenceIndicators) allIndicators.push(...result.negligenceIndicators);
        if (result.keyEvidence) allEvidence.push(...result.keyEvidence);
        if (result.expertRecommendations) allRecommendations.push(...result.expertRecommendations);
      }
      
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log('Analysis complete. Found ' + allIndicators.length + ' indicators');

    const highSeverityCount = allIndicators.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = allIndicators.filter(i => i.severity === 'medium').length;
    
    let overallSeverity: 'low' | 'medium' | 'high' = 'low';
    if (highSeverityCount > 0) {
      overallSeverity = 'high';
    } else if (mediumSeverityCount > 1) {
      overallSeverity = 'high';
    } else if (mediumSeverityCount > 0 || allIndicators.length > 2) {
      overallSeverity = 'medium';
    }

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const uniqueRecommendations = Array.from(
      new Map(allRecommendations.map(r => [r.expertType, r])).values()
    ).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const result = {
      success: true,
      fileName,
      overallSeverity,
      negligenceIndicators: allIndicators,
      keyEvidence: allEvidence.slice(0, 20),
      expertRecommendations: uniqueRecommendations,
      metadata: {
        documentLength: extractedText.length,
        chunksProcessed: chunks.length,
        processingTime,
        indicatorCount: allIndicators.length,
        evidenceCount: allEvidence.length,
        recommendationCount: uniqueRecommendations.length
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
    const { fileData, fileName, fileType } = await req.json();

    if (!fileData) {
      throw new Error('No file data provided');
    }

    console.log('Processing medical document:', fileName, 'Type:', fileType);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      throw new Error('Invalid authorization');
    }

    const userId = userData.user.id;

    // Create initial task record
    const { data: taskData, error: insertError } = await supabaseAdmin
      .from('negligence_analysis_history')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileData.length,
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
    EdgeRuntime.waitUntil(processNegligenceAnalysis(taskId, fileData, fileName, fileType, userId));

    // Return immediately with task ID
    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      status: 'processing',
      message: 'Analysis started. You can navigate away - results will be saved automatically.'
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

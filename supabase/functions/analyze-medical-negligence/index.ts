import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { fileData, fileName, fileType } = await req.json();

    if (!fileData) {
      throw new Error('No file data provided');
    }

    console.log('Processing medical document:', fileName, 'Type:', fileType);

    // Decode base64 file data
    const decodedData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    
    let extractedText = '';

    // Extract text based on file type
    if (fileType === 'text/plain') {
      extractedText = new TextDecoder().decode(decodedData);
    } else if (fileType === 'application/pdf') {
      console.log('Extracting text from PDF...');
      extractedText = await extractTextFromPDF(decodedData);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        extractedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedData);
        extractedText = extractedText.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      } catch {
        throw new Error('Failed to extract text from Word document. Please try converting to PDF first.');
      }
    } else {
      throw new Error('Unsupported file type. Please upload PDF, Word, or text files.');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      console.error('Failed to extract text. File may be scanned/image-based PDF.');
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract text from document. If this is a scanned document, please use an OCR tool first to convert it to searchable text, or try uploading a Word document or text file instead.',
          details: 'The document appears to be image-based (scanned PDF) with no extractable text.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Extracted text length:', extractedText.length);

    // Call Lovable AI for negligence analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Chunk text for processing
    const chunks = chunkText(extractedText, 15000);
    console.log(`Analyzing ${chunks.length} chunk(s)...`);

    let allIndicators: NegligenceIndicator[] = [];
    let allEvidence: KeyEvidence[] = [];
    let allRecommendations: ExpertRecommendation[] = [];

    // Process chunks in batches
    const BATCH_SIZE = 2;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
      
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const chunkIdx = batchStart + batchIdx;
          
          const analysisPrompt = `You are a medical-legal expert analyzing clinical records for potential negligence. Perform a comprehensive, detailed analysis.

DOCUMENT SECTION ${chunkIdx + 1}/${chunks.length}:
${chunk}

COMPREHENSIVE ANALYSIS REQUIREMENTS:

1. NEGLIGENCE INDICATORS - Identify with medical reasoning:
   Categories: diagnostic_error, treatment_delay, medication_error, consent_issue, documentation_failure, communication_breakdown, surgical_complication, monitoring_failure, discharge_planning_error, follow_up_failure
   
   For each indicator provide:
   - Specific finding with medical details
   - Clinical context and standard of care deviation
   - Severity with justification
   - Direct supporting evidence with quotes/references
   - Causal link to patient harm or risk
   - Relevant medical standards or guidelines violated

2. KEY EVIDENCE - Extract with clinical significance:
   - Precise dates and times when available
   - Detailed description of medical events
   - Clinical significance and context
   - Relevance to potential negligence
   - Link to specific negligence indicators
   - Any missing information or gaps
   
3. EXPERT RECOMMENDATIONS - Justify comprehensively:
   - Specific expert type needed
   - Detailed reason based on findings
   - What specific aspects they should review
   - Priority with clinical justification
   - Expected contribution to case

4. MEDICAL CONTEXT:
   - Patient condition timeline
   - Standard of care expectations
   - Causal relationships between events
   - Potential consequences of identified issues

Return detailed JSON:
{
  "negligenceIndicators": [
    {
      "category": "diagnostic_error|treatment_delay|medication_error|consent_issue|documentation_failure|communication_breakdown|surgical_complication|monitoring_failure|discharge_planning_error|follow_up_failure",
      "finding": "detailed specific description with medical terminology",
      "severity": "low|medium|high",
      "evidence": "direct supporting evidence from document with quotes",
      "clinicalContext": "explanation of standard of care and deviation",
      "causalLink": "how this relates to patient harm or risk",
      "standardsViolated": "relevant medical standards or guidelines"
    }
  ],
  "keyEvidence": [
    {
      "type": "procedure|medication|diagnosis|test|consultation|event|complication|vital_signs|lab_result",
      "date": "YYYY-MM-DD or null",
      "description": "detailed description of what happened",
      "relevance": "clinical significance and why this matters",
      "linkedIndicators": "which negligence indicators this supports",
      "clinicalSignificance": "medical interpretation"
    }
  ],
  "expertRecommendations": [
    {
      "expertType": "specific medical specialty",
      "reason": "detailed justification based on findings",
      "specificReviewAreas": "what aspects they should examine",
      "priority": "low|medium|high",
      "expectedContribution": "what insights this expert will provide"
    }
  ],
  "medicalContext": {
    "patientTimeline": "brief chronology of key events",
    "standardOfCare": "relevant standards applicable to this case",
    "causalChain": "sequence of events and their relationships"
  }
}

If no negligence indicators found, return empty arrays but still provide medical context.

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [{ role: 'user', content: analysisPrompt }],
              temperature: 0.1,
              response_format: { type: "json_object" }
            }),
          });

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              throw new Error('Rate limit exceeded. Please try again in a moment.');
            }
            throw new Error(`AI processing failed: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          return JSON.parse(aiData.choices[0].message.content);
        })
      );

      // Aggregate results
      for (const result of batchResults) {
        if (result.negligenceIndicators) allIndicators.push(...result.negligenceIndicators);
        if (result.keyEvidence) allEvidence.push(...result.keyEvidence);
        if (result.expertRecommendations) allRecommendations.push(...result.expertRecommendations);
      }
      
      // Small delay between batches
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Analysis complete. Found ${allIndicators.length} indicators, ${allEvidence.length} evidence items, ${allRecommendations.length} expert recommendations.`);

    // Calculate overall severity
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

    // Deduplicate and prioritize recommendations
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
      keyEvidence: allEvidence.slice(0, 20), // Limit to top 20 evidence items
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

    console.log('Final results:', {
      success: true,
      overallSeverity,
      indicators: allIndicators.length,
      evidence: allEvidence.length,
      recommendations: uniqueRecommendations.length,
      processingTime: `${processingTime}s`
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-medical-negligence function:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        errorMessage = 'AI service rate limit exceeded. Please try again in a moment.';
        statusCode = 429;
      } else if (error.message.includes('Payment')) {
        errorMessage = 'AI service credits exhausted. Please contact support.';
        statusCode = 402;
      } else if (error.message.includes('extract text')) {
        errorMessage = error.message;
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

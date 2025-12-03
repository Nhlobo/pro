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

// Helper function to extract text from PDF using DocuPipe OCR
async function extractTextWithOCR(base64Data: string, fileName: string): Promise<string> {
  const DOCUPIPE_API_KEY = Deno.env.get('DOCUPIPE_API_KEY');
  if (!DOCUPIPE_API_KEY) {
    throw new Error('DOCUPIPE_API_KEY is not configured');
  }

  console.log('Using DocuPipe OCR for scanned document...');

  try {
    const formData = new FormData();
    // Convert base64 to blob
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
    
    // Extract text from DocuPipe response
    if (result.text) {
      console.log('OCR extraction successful, text length:', result.text.length);
      return result.text;
    } else if (result.pages && Array.isArray(result.pages)) {
      // If text is in pages array
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
      
      // Check if PDF is scanned (has very little text)
      if (!extractedText || extractedText.trim().length < 100) {
        console.log('PDF appears to be scanned or has minimal text. Using OCR...');
        try {
          extractedText = await extractTextWithOCR(fileData, fileName);
        } catch (ocrError) {
          console.error('OCR failed:', ocrError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to extract text from scanned document using OCR.',
              details: ocrError instanceof Error ? ocrError.message : 'OCR processing failed'
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
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
      console.error('Failed to extract text even after OCR attempt.');
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract any text from document. The file may be corrupted, password-protected, or contain only images without text.',
          details: 'Text extraction and OCR both failed.'
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
            if (aiResponse.status === 429) {
              throw new Error('Rate limit exceeded. Please try again in a moment.');
            }
            throw new Error('AI processing failed: ' + aiResponse.status);
          }

          const aiData = await aiResponse.json();
          let content = aiData.choices[0].message.content;
          
          // Clean up the response - remove markdown code blocks if present
          content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            content = jsonMatch[0];
          }
          
          try {
            return JSON.parse(content);
          } catch (parseError) {
            console.error('JSON parse error for chunk ' + chunkIdx + ':', parseError);
            console.error('Raw content:', content.substring(0, 500));
            // Return empty result for this chunk instead of failing entirely
            return {
              negligenceIndicators: [],
              keyEvidence: [],
              expertRecommendations: []
            };
          }
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

    console.log('Analysis complete. Found ' + allIndicators.length + ' indicators, ' + allEvidence.length + ' evidence items, ' + allRecommendations.length + ' expert recommendations.');

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
      processingTime: processingTime + 's'
    });

    // Save to history if user is authenticated
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          {
            auth: {
              persistSession: false,
            },
          }
        );

        // Get user from auth header
        const token = authHeader.replace('Bearer ', '');
        const { data: userData } = await supabaseAdmin.auth.getUser(token);

        if (userData?.user) {
          console.log('Saving negligence analysis to history for user:', userData.user.id);

          await supabaseAdmin.from('negligence_analysis_history').insert({
            user_id: userData.user.id,
            file_name: fileName,
            file_type: fileType,
            file_size: decodedData.length,
            overall_severity: overallSeverity,
            indicator_count: allIndicators.length,
            evidence_count: allEvidence.length,
            recommendation_count: uniqueRecommendations.length,
            processing_time: processingTime,
            analysis_result: result
          });

          console.log('Negligence analysis saved to history');
        }
      } catch (historyError) {
        console.error('Failed to save to history (non-critical):', historyError);
      }
    }

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

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Change {
  type: string;
  original: string;
  corrected: string;
  line: number;
  reason: string;
}

interface Issue {
  category: string;
  severity: string;
  message: string;
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

// Helper function to split into large chunks for summarization
function splitIntoChunks(text: string, size: number = 90000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.substring(i, i + size));
  }
  return chunks;
}

// Helper function to chunk text for processing
function chunkText(text: string, maxChunkSize: number = 12000): string[] {
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

// Helper function to summarize a large chunk
async function summarizeChunk(text: string, chunkIndex: number, totalChunks: number, apiKey: string): Promise<string> {
  const prompt = `Summarize this medico-legal report section ${chunkIndex + 1}/${totalChunks}, preserving all medical terminology, findings, and key details. Remove only repeated phrases and redundant explanations.

TEXT:
${text.substring(0, 85000)}

Return a concise summary maintaining medical accuracy.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Summarization failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to trim response safely
function trimResponse(text: string, maxLength: number = 20000): string {
  if (text.length <= maxLength) return text;
  
  // Try to cut at paragraph boundary
  const cutPoint = text.lastIndexOf('\n\n', maxLength);
  if (cutPoint > maxLength * 0.8) {
    return text.substring(0, cutPoint) + '\n\n[Document trimmed for size...]';
  }
  
  return text.substring(0, maxLength) + '\n\n[Document trimmed for size...]';
}

// Negligence detection removed to reduce compute time and avoid Edge Function timeouts

// Summary generation removed to reduce compute time and avoid Edge Function timeouts

// Structured analysis removed to reduce compute time and avoid Edge Function timeouts

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

    console.log('Processing document:', fileName, 'Type:', fileType);

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
      // For Word docs, try basic text extraction
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
      throw new Error('Could not extract text from document. The file may be empty, corrupted, or contain only images.');
    }

    console.log('Extracted text length:', extractedText.length);

    // Call Lovable AI for proofreading
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Pre-check: Handle very large documents with chunking and summarization
    const MAX_TEXT_LENGTH = 120000; // ~120k characters max (40-50 pages)
    let processedText = extractedText;
    let compressionApplied = false;
    let largeChunkCount = 0;

    if (extractedText.length > MAX_TEXT_LENGTH) {
      console.log(`Document too large (${Math.round(extractedText.length / 1000)}k chars) - applying smart compression...`);
      compressionApplied = true;
      
      // Split into 90k chunks
      const largeChunks = splitIntoChunks(extractedText, 90000);
      largeChunkCount = largeChunks.length;
      console.log(`Split into ${largeChunks.length} large chunks for processing...`);
      
      // Summarize each chunk
      const summaries: string[] = [];
      for (let i = 0; i < largeChunks.length; i++) {
        console.log(`Summarizing chunk ${i + 1}/${largeChunks.length}...`);
        try {
          const summary = await summarizeChunk(largeChunks[i], i, largeChunks.length, LOVABLE_API_KEY);
          summaries.push(summary);
          
          // Delay to avoid rate limits
          if (i < largeChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Failed to summarize chunk ${i + 1}:`, error);
          // Use truncated version instead
          summaries.push(largeChunks[i].substring(0, 10000) + '...[truncated]');
        }
      }
      
      // Combine all summaries
      processedText = summaries.join('\n\n---\n\n');
      console.log(`Compression complete: ${extractedText.length} -> ${processedText.length} characters`);
    }

    // Check for document quality issues
    const issues: Issue[] = [];
    
    if (extractedText.length < 100) {
      issues.push({
        category: 'Document Length',
        severity: 'high',
        message: 'Document appears to be too short or incomplete'
      });
    }

    // Add status for large documents
    if (compressionApplied) {
      issues.push({
        category: 'Processing',
        severity: 'info',
        message: `Document was large (${Math.round(extractedText.length / 1000)}k chars) - smart compression applied`
      });
    }

    // Optimize: Process multiple chunks in parallel (max 3 at a time to avoid rate limits)
    const chunks = chunkText(processedText, 15000); // Larger chunks for faster processing
    console.log(`Proofreading ${chunks.length} chunk(s) (${processedText.length} total characters)...`);

    let allChanges: Change[] = [];
    let correctedText = processedText;

    // Process chunks in batches of 3 for parallel processing
    const BATCH_SIZE = 3;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const chunkIdx = batchStart + batchIdx;
          
          const proofreadingPrompt = `Proofread this medico-legal report section and identify errors quickly.

SECTION ${chunkIdx + 1}/${chunks.length}:
${chunk}

Check: spelling, grammar, medical terms, formatting.

Return JSON:
{
  "correctedText": "corrected text",
  "changes": [{"type": "spelling|grammar|medical|formatting", "original": "error", "corrected": "fix", "line": 0, "reason": "brief explanation"}]
}

Empty changes array if no errors.`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{ role: 'user', content: proofreadingPrompt }],
              temperature: 0.1, // Lower temperature for faster, more consistent results
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
          return { chunkIdx, chunk, result: JSON.parse(aiData.choices[0].message.content) };
        })
      );

      // Process batch results
      for (const { chunkIdx, chunk, result } of batchResults) {
        if (result.changes && Array.isArray(result.changes)) {
          allChanges.push(...result.changes);
        }
        
        if (result.correctedText) {
          correctedText = correctedText.replace(chunk, result.correctedText);
        }
      }
      
      // Small delay between batches
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Proofreading complete. Found ${allChanges.length} issues.`);

    // Calculate quality score
    const totalWords = extractedText.split(/\s+/).length;
    const totalChanges = allChanges.length;
    const errorRate = Math.min((totalChanges / totalWords) * 100, 50);
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - errorRate * 2)));

    // Calculate metadata
    const totalSentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = totalWords / totalSentences || 0;
    const readingLevel = avgWordsPerSentence > 20 ? 'Advanced' : 
                        avgWordsPerSentence > 15 ? 'Intermediate' : 'Basic';

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    // Trim response if needed
    const trimmedOriginal = trimResponse(extractedText, 20000);
    const trimmedCorrected = trimResponse(correctedText, 20000);

    // Generate simple recommendation based on changes
    let recommendation = 'Document processed successfully.';
    if (allChanges.length > 20) {
      recommendation = `${allChanges.length} corrections made. Quality review recommended.`;
    } else if (allChanges.length > 0) {
      recommendation = `${allChanges.length} minor corrections made.`;
    }

    const result = {
      success: true,
      originalText: trimmedOriginal,
      correctedText: trimmedCorrected,
      changes: allChanges,
      qualityScore,
      issues,
      metadata: {
        totalWords,
        totalSentences,
        readingLevel,
        processingTime,
        chunksProcessed: chunks.length,
        compressionApplied,
        originalSize: compressionApplied ? `${Math.round(extractedText.length / 1000)}k chars` : undefined,
        compressedSize: compressionApplied ? `${Math.round(processedText.length / 1000)}k chars` : undefined,
        chunkCount: compressionApplied ? largeChunkCount : undefined
      },
      recommendation
    };

    console.log('Final results:', {
      success: true,
      changes: result.changes.length,
      qualityScore,
      processingTime: `${processingTime}s`,
      chunks: chunks.length,
      compressed: compressionApplied
    });

    // Save to history if we have authorization header
    try {
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.54.0');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseClient = createClient(supabaseUrl, token);
        
        await supabaseClient.from('proofreading_history').insert({
          file_name: fileName,
          file_type: fileType,
          file_size: decodedData.length,
          quality_score: qualityScore,
          total_changes: allChanges.length,
          total_words: totalWords,
          compression_applied: compressionApplied,
          original_size: compressionApplied ? `${Math.round(extractedText.length / 1000)}k chars` : null,
          compressed_size: compressionApplied ? `${Math.round(processedText.length / 1000)}k chars` : null,
          processing_time: processingTime
        });
        
        console.log('Saved to proofreading history');
      }
    } catch (historyError) {
      console.error('Failed to save history (non-critical):', historyError);
      // Don't fail the whole request if history save fails
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in proofread-document function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

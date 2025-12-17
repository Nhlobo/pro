import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface ParagraphIssue {
  issue: string;
  location: string;
  suggestion: string;
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
  
  const cutPoint = text.lastIndexOf('\n\n', maxLength);
  if (cutPoint > maxLength * 0.8) {
    return text.substring(0, cutPoint) + '\n\n[Document trimmed for size...]';
  }
  
  return text.substring(0, maxLength) + '\n\n[Document trimmed for size...]';
}

// Background processing function
async function processProofreading(
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
    console.log('Background proofreading started for task:', taskId);
    
    // Update status to processing
    await supabaseAdmin.from('proofreading_history').update({
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

    // Handle very large documents
    const MAX_TEXT_LENGTH = 120000;
    let processedText = extractedText;
    let compressionApplied = false;
    let largeChunkCount = 0;

    if (extractedText.length > MAX_TEXT_LENGTH) {
      console.log(`Document too large - applying compression...`);
      compressionApplied = true;
      
      const largeChunks = splitIntoChunks(extractedText, 90000);
      largeChunkCount = largeChunks.length;
      
      const summaries: string[] = [];
      for (let i = 0; i < largeChunks.length; i++) {
        console.log(`Summarizing chunk ${i + 1}/${largeChunks.length}...`);
        try {
          const summary = await summarizeChunk(largeChunks[i], i, largeChunks.length, LOVABLE_API_KEY);
          summaries.push(summary);
          if (i < largeChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          summaries.push(largeChunks[i].substring(0, 10000) + '...[truncated]');
        }
      }
      
      processedText = summaries.join('\n\n---\n\n');
    }

    const issues: Issue[] = [];
    
    if (extractedText.length < 100) {
      issues.push({
        category: 'Document Length',
        severity: 'high',
        message: 'Document appears to be too short or incomplete'
      });
    }

    if (compressionApplied) {
      issues.push({
        category: 'Processing',
        severity: 'info',
        message: `Document was large - smart compression applied`
      });
    }

    const chunks = chunkText(processedText, 15000);
    console.log(`Proofreading ${chunks.length} chunk(s)...`);

    let allChanges: Change[] = [];
    let allParagraphIssues: ParagraphIssue[] = [];
    let correctedText = processedText;

    const BATCH_SIZE = 3;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
      
      const batchResults = await Promise.all(
        batchChunks.map(async (chunk, batchIdx) => {
          const chunkIdx = batchStart + batchIdx;
          
          const proofreadingPrompt = `You are a medico-legal document proofreader. Focus ONLY on spelling and grammar errors.

SECTION ${chunkIdx + 1}/${chunks.length}:
${chunk}

=== WHAT TO CHECK (ONLY THESE) ===

1. SPELLING ERRORS:
   - Misspelled words
   - Incorrect medical terminology spelling (e.g., "lumbar" not "lumber", "cervical" not "cervial")
   - Incorrect names (claimant, expert, attorney names if they appear inconsistent)
   - Typos and misspellings

2. GRAMMAR ERRORS:
   - Subject-verb agreement
   - Tense consistency
   - Punctuation errors (missing periods, commas, etc.)
   - Sentence fragments
   - Run-on sentences

=== DO NOT CHECK OR FLAG ===
- Spacing issues (extra spaces, missing spaces between paragraphs)
- Paragraph length or structure
- Formatting or layout issues
- Line breaks or indentation
- Any spacing-related concerns

=== CRITICAL: DO NOT CHANGE ===
- Medical conclusions
- Expert opinions
- Clinical findings
- Diagnostic statements
- Treatment recommendations
- Any medical content - only correct spelling/grammar

Return JSON:
{
  "correctedText": "corrected text with spelling/grammar fixes only",
  "changes": [
    {
      "type": "spelling|grammar|medical_term|name_inconsistency",
      "original": "the exact error text",
      "corrected": "the correction",
      "line": 0,
      "reason": "brief explanation"
    }
  ],
  "paragraphIssues": []
}

Empty changes array if no spelling/grammar errors found. Always return empty paragraphIssues array.`;

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{ role: 'user', content: proofreadingPrompt }],
              temperature: 0.1,
            }),
          });

          if (!aiResponse.ok) {
            throw new Error(`AI processing failed: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          let content = aiData.choices[0].message.content;
          
          // Clean JSON response
          content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) content = jsonMatch[0];
          
          try {
            return { chunkIdx, chunk, result: JSON.parse(content) };
          } catch {
            return { chunkIdx, chunk, result: { correctedText: chunk, changes: [] } };
          }
        })
      );

      for (const { chunkIdx, chunk, result } of batchResults) {
        if (result.changes && Array.isArray(result.changes)) {
          allChanges.push(...result.changes);
        }
        if (result.paragraphIssues && Array.isArray(result.paragraphIssues)) {
          allParagraphIssues.push(...result.paragraphIssues);
        }
        if (result.correctedText) {
          correctedText = correctedText.replace(chunk, result.correctedText);
        }
      }
      
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Proofreading complete. Found ${allChanges.length} issues.`);

    const totalWords = extractedText.split(/\s+/).length;
    const totalChanges = allChanges.length;
    const errorRate = Math.min((totalChanges / totalWords) * 100, 50);
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - errorRate * 2)));

    const totalSentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = totalWords / totalSentences || 0;
    const readingLevel = avgWordsPerSentence > 20 ? 'Advanced' : 
                        avgWordsPerSentence > 15 ? 'Intermediate' : 'Basic';

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const trimmedOriginal = trimResponse(extractedText, 20000);
    const trimmedCorrected = trimResponse(correctedText, 20000);

    let recommendation = 'Document processed successfully. No spelling or grammar errors found.';
    if (allChanges.length > 20) {
      recommendation = `${allChanges.length} spelling/grammar corrections found. Quality review recommended.`;
    } else if (allChanges.length > 0) {
      recommendation = `${allChanges.length} spelling/grammar corrections made.`;
    }

    // Categorize changes by type for summary
    const changesByType = allChanges.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const result = {
      success: true,
      originalText: trimmedOriginal,
      correctedText: trimmedCorrected,
      changes: allChanges,
      paragraphIssues: allParagraphIssues,
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
        chunkCount: compressionApplied ? largeChunkCount : undefined,
        changesByType
      },
      recommendation
    };

    // Update with completed status and results
    await supabaseAdmin.from('proofreading_history').update({
      status: 'completed',
      quality_score: qualityScore,
      total_changes: allChanges.length,
      total_words: totalWords,
      compression_applied: compressionApplied,
      original_size: compressionApplied ? `${Math.round(extractedText.length / 1000)}k chars` : null,
      compressed_size: compressionApplied ? `${Math.round(processedText.length / 1000)}k chars` : null,
      processing_time: processingTime,
      result_data: result
    }).eq('id', taskId);

    console.log('Background proofreading completed for:', taskId);

  } catch (error) {
    console.error('Background proofreading error:', error);
    await supabaseAdmin.from('proofreading_history').update({
      status: 'failed',
      result_data: { error: error instanceof Error ? error.message : 'Unknown error' }
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

    console.log('Processing document:', fileName, 'Type:', fileType);

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
    const decodedData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

    // Create initial task record
    const { data: taskData, error: insertError } = await supabaseAdmin
      .from('proofreading_history')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_size: decodedData.length,
        quality_score: 0,
        total_changes: 0,
        total_words: 0,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError || !taskData) {
      throw new Error('Failed to create task: ' + insertError?.message);
    }

    const taskId = taskData.id;
    console.log('Created background proofreading task:', taskId);

    // Start background processing
    EdgeRuntime.waitUntil(processProofreading(taskId, fileData, fileName, fileType, userId));

    // Return immediately with task ID
    return new Response(JSON.stringify({ 
      success: true, 
      taskId,
      status: 'processing',
      message: 'Proofreading started. You can navigate away - results will be saved automatically.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in proofread-document function:', error);
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

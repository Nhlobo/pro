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

    // Check document size limits
    const MAX_TEXT_LENGTH = 120000; // ~120k characters max (40-50 pages)
    if (extractedText.length > MAX_TEXT_LENGTH) {
      throw new Error(`Document is too large (${Math.round(extractedText.length / 1000)}k characters). Please limit documents to approximately 40 pages or ${Math.round(MAX_TEXT_LENGTH / 1000)}k characters.`);
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

    if (extractedText.split('\n').length < 5) {
      issues.push({
        category: 'Structure',
        severity: 'medium',
        message: 'Document has very few paragraphs, may be missing sections'
      });
    }

    // Call Lovable AI for proofreading
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Chunk the text if it's too large
    const chunks = chunkText(extractedText, 12000);
    console.log(`Processing ${chunks.length} chunk(s) (${extractedText.length} total characters)...`);
    
    if (chunks.length > 12) {
      throw new Error(`Document is too complex (${chunks.length} sections). Please break it into smaller documents of 30-35 pages each.`);
    }

    let allChanges: Change[] = [];
    let correctedText = extractedText;

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
      
      const proofreadingPrompt = `Proofread this medico-legal report section and identify errors.

SECTION ${i + 1}/${chunks.length}:
${chunks[i]}

Check: spelling, grammar, medical terminology, formatting, repeated phrases.

Return JSON:
{
  "correctedText": "corrected text",
  "changes": [{"type": "spelling|grammar|medical|formatting|repetition|missing|other", "original": "error", "corrected": "fix", "line": 0, "reason": "explanation"}]
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
          messages: [
            { role: 'user', content: proofreadingPrompt }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        throw new Error(`AI processing failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const aiContent = aiData.choices[0].message.content;

      // Parse AI response
      try {
        const chunkResult = JSON.parse(aiContent);
        
        if (chunkResult.changes && Array.isArray(chunkResult.changes)) {
          allChanges.push(...chunkResult.changes);
        }
        
        // Replace the chunk in correctedText
        if (chunkResult.correctedText) {
          correctedText = correctedText.replace(chunks[i], chunkResult.correctedText);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response for chunk', i + 1, ':', parseError);
        console.error('Raw content:', aiContent);
        // Continue processing other chunks
      }
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
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

    const result = {
      originalText: extractedText,
      correctedText,
      changes: allChanges,
      qualityScore,
      issues,
      metadata: {
        totalWords,
        totalSentences,
        readingLevel,
        processingTime,
        chunksProcessed: chunks.length
      }
    };

    console.log('Final results:', {
      changes: result.changes.length,
      qualityScore,
      processingTime: `${processingTime}s`,
      chunks: chunks.length
    });

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

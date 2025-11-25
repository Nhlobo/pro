import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    } else if (fileType === 'application/pdf' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For PDF and Word docs, we'll use a simplified extraction
      // In production, you'd use proper libraries for this
      try {
        extractedText = new TextDecoder().decode(decodedData);
      } catch {
        // If direct decode fails, treat as binary and extract readable text
        extractedText = new TextDecoder('utf-8', { fatal: false }).decode(decodedData);
        // Remove non-printable characters
        extractedText = extractedText.replace(/[^\x20-\x7E\n\r\t]/g, '');
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Could not extract text from document. The file may be corrupted or contain only images.');
    }

    console.log('Extracted text length:', extractedText.length);

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

    const proofreadingPrompt = `You are a professional proofreader specializing in medico-legal reports. Analyze this document and identify ALL issues:

DOCUMENT TEXT:
${extractedText}

Identify and correct:
1. Spelling errors
2. Grammar mistakes
3. Missing words or incomplete sentences
4. Repeated sentences or phrases
5. Incorrect medical terminology
6. Inconsistent formatting or capitalization
7. Date format issues
8. Potential name or ID inconsistencies

Return a JSON object with this exact structure:
{
  "correctedText": "full corrected text",
  "changes": [
    {
      "type": "spelling|grammar|medical|formatting|repetition|missing|other",
      "original": "original text",
      "corrected": "corrected text",
      "line": line_number,
      "reason": "brief explanation"
    }
  ]
}

Be thorough and identify ALL issues, even minor ones.`;

    console.log('Calling Lovable AI for proofreading...');

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
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    console.log('AI response received');

    // Parse AI response
    let proofreadingResult;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       aiContent.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        proofreadingResult = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not find JSON in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw AI content:', aiContent);
      throw new Error('Failed to parse proofreading results');
    }

    // Calculate quality score
    const totalWords = extractedText.split(/\s+/).length;
    const totalChanges = proofreadingResult.changes?.length || 0;
    const errorRate = (totalChanges / totalWords) * 100;
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - errorRate * 2)));

    // Calculate metadata
    const totalSentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = totalWords / totalSentences;
    const readingLevel = avgWordsPerSentence > 20 ? 'Advanced' : 
                        avgWordsPerSentence > 15 ? 'Intermediate' : 'Basic';

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const result = {
      originalText: extractedText,
      correctedText: proofreadingResult.correctedText || extractedText,
      changes: proofreadingResult.changes || [],
      qualityScore,
      issues,
      metadata: {
        totalWords,
        totalSentences,
        readingLevel,
        processingTime,
      }
    };

    console.log('Proofreading complete:', {
      changes: result.changes.length,
      qualityScore,
      processingTime
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

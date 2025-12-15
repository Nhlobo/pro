import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Case types
type CaseType = 'road_accident' | 'slip_and_fall' | 'unlawful_arrest';

interface ExtractedFacts {
  dateOfIncident: string | null;
  location: string | null;
  treatingFacility: string | null;
  natureOfIncident: string;
  injuriesSustained: string[];
  treatmentReceived: string[];
  missingDocuments: string[];
  documentTypes: string[];
}

interface InjuryAnalysis {
  type: string;
  category: 'orthopaedic' | 'neurological' | 'psychological' | 'soft_tissue' | 'internal' | 'other';
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  description: string;
}

interface ExpertRecommendation {
  expertType: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  linkedToInjury: string;
}

interface PrescriptionStatus {
  status: 'within_period' | 'approaching' | 'likely_expired';
  timeElapsed: string;
  prescriptionPeriod: string;
  urgentAction: boolean;
  details: string;
}

interface AttorneyConflict {
  hasConflict: boolean;
  conflictDetails: string | null;
  existingAttorney: string | null;
  existingCaseId: string | null;
}

interface CaseViability {
  recommendation: 'take' | 'caution' | 'do_not_take';
  confidence: number;
  strengthOfFacts: 'strong' | 'moderate' | 'weak';
  medicalConsistency: 'consistent' | 'some_gaps' | 'inconsistent';
  injurySeverity: 'severe' | 'moderate' | 'minor';
  documentationQuality: 'complete' | 'partial' | 'poor';
  reasons: string[];
}

interface CaseScreeningResult {
  caseTypes: CaseType[];
  extractedFacts: ExtractedFacts;
  injuries: InjuryAnalysis[];
  expertRecommendations: ExpertRecommendation[];
  prescriptionStatus: PrescriptionStatus;
  attorneyConflict: AttorneyConflict;
  viability: CaseViability;
  screeningOpinion: {
    caseTypeSummary: string;
    factsSummary: string;
    injuriesSummary: string;
    medicalConsistency: string;
    legalIssues: string[];
    finalRecommendation: string;
  };
  disclaimer: string;
  processedAt: string;
}

// Prescription periods by case type (in years)
const PRESCRIPTION_PERIODS: Record<CaseType, number> = {
  road_accident: 3, // RAF claims typically 3 years
  slip_and_fall: 3, // General delict 3 years
  unlawful_arrest: 3, // Constitutional claims 3 years
};

async function extractTextFromDocument(
  fileContent: string,
  fileType: string,
  fileName: string
): Promise<string> {
  // Check if it's a scanned PDF that needs OCR
  if (fileType === 'application/pdf') {
    const textContent = atob(fileContent);
    const hasMinimalText = textContent.replace(/[^a-zA-Z]/g, '').length < 500;
    
    if (hasMinimalText) {
      // Use DocuPipe for OCR
      const docupipeApiKey = Deno.env.get('DOCUPIPE_API_KEY');
      if (docupipeApiKey) {
        try {
          console.log('Using DocuPipe OCR for scanned document...');
          const response = await fetch('https://api.docupipe.io/v1/reader', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${docupipeApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: fileContent,
              filename: fileName,
              output_format: 'text'
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            return result.text || result.content || '';
          }
        } catch (error) {
          console.error('DocuPipe OCR error:', error);
        }
      }
    }
    return textContent;
  }
  
  return atob(fileContent);
}

async function analyzeWithAI(
  text: string,
  supabaseAdmin: any,
  claimantName?: string
): Promise<CaseScreeningResult> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('AI API key not configured');
  }

  const systemPrompt = `You are an expert medico-legal case screening analyst specializing in South African personal injury law. Your role is to screen cases for Road Accident Fund (RAF) claims, Slip and Fall incidents, and Unlawful Arrest/Detention cases.

CRITICAL INSTRUCTIONS:
1. Analyze the provided medical records and case documents thoroughly
2. Identify the case type(s) based on the content
3. Extract all relevant facts including dates, locations, injuries, and treatments
4. Assess case viability based on strength of facts, medical consistency, and documentation
5. Identify injuries and recommend appropriate medical experts
6. Calculate prescription status based on South African law
7. Provide a structured screening opinion

CASE TYPE DEFINITIONS:
- road_accident: Motor vehicle accidents, RAF claims, pedestrian incidents
- slip_and_fall: Premises liability, workplace accidents, public space falls
- unlawful_arrest: Police brutality, wrongful detention, assault by authorities

PRESCRIPTION PERIODS (South Africa):
- Road Accident (RAF): 3 years from date of accident
- Slip and Fall: 3 years from date of incident
- Unlawful Arrest: 3 years from date of incident

INJURY CATEGORIES:
- orthopaedic: Bone fractures, joint injuries, spinal injuries
- neurological: Head injuries, nerve damage, brain injuries
- psychological: PTSD, depression, anxiety, trauma
- soft_tissue: Muscle injuries, ligament tears, bruising
- internal: Organ damage, internal bleeding
- other: Other injuries not categorized above

VIABILITY ASSESSMENT CRITERIA:
- TAKE: Strong facts, consistent medical records, significant injuries, within prescription
- CAUTION: Some gaps in documentation, moderate injuries, or approaching prescription
- DO NOT TAKE: Weak facts, inconsistent records, minor injuries, or likely prescribed

You must respond with a valid JSON object matching the required schema.`;

  const userPrompt = `Analyze the following case documents and provide a comprehensive screening assessment.

${claimantName ? `Claimant Name: ${claimantName}` : ''}

DOCUMENT CONTENT:
${text.substring(0, 100000)}

Provide your analysis as a JSON object with this exact structure:
{
  "caseTypes": ["road_accident" | "slip_and_fall" | "unlawful_arrest"],
  "extractedFacts": {
    "dateOfIncident": "YYYY-MM-DD or null",
    "location": "string or null",
    "treatingFacility": "string or null",
    "natureOfIncident": "detailed description",
    "injuriesSustained": ["injury1", "injury2"],
    "treatmentReceived": ["treatment1", "treatment2"],
    "missingDocuments": ["document1", "document2"],
    "documentTypes": ["medical_records", "police_report", "hospital_notes", etc.]
  },
  "injuries": [
    {
      "type": "injury name",
      "category": "orthopaedic|neurological|psychological|soft_tissue|internal|other",
      "severity": "minor|moderate|severe|critical",
      "description": "detailed description"
    }
  ],
  "expertRecommendations": [
    {
      "expertType": "Orthopaedic Surgeon|Neurosurgeon|General Surgeon|Emergency Medicine Specialist|Occupational Therapist|Clinical Psychologist|Industrial Psychologist|Psychiatrist|Nursing Expert|Forensic Medical Practitioner",
      "reason": "reason for recommendation",
      "priority": "high|medium|low",
      "linkedToInjury": "which injury this relates to"
    }
  ],
  "prescriptionStatus": {
    "status": "within_period|approaching|likely_expired",
    "timeElapsed": "X years Y months",
    "prescriptionPeriod": "3 years",
    "urgentAction": true|false,
    "details": "explanation"
  },
  "viability": {
    "recommendation": "take|caution|do_not_take",
    "confidence": 0-100,
    "strengthOfFacts": "strong|moderate|weak",
    "medicalConsistency": "consistent|some_gaps|inconsistent",
    "injurySeverity": "severe|moderate|minor",
    "documentationQuality": "complete|partial|poor",
    "reasons": ["reason1", "reason2"]
  },
  "screeningOpinion": {
    "caseTypeSummary": "summary of case type and nature",
    "factsSummary": "summary of key facts",
    "injuriesSummary": "summary of injuries",
    "medicalConsistency": "assessment of medical record consistency",
    "legalIssues": ["potential legal issue 1", "potential legal issue 2"],
    "finalRecommendation": "detailed final recommendation"
  }
}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', errorText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse JSON from response
  let analysisResult;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysisResult = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    throw new Error('Failed to parse AI response');
  }

  return {
    ...analysisResult,
    attorneyConflict: {
      hasConflict: false,
      conflictDetails: null,
      existingAttorney: null,
      existingCaseId: null
    },
    disclaimer: "SCREENING OPINION – Subject to Legal & Expert Review. This is an initial screening opinion only and does not constitute legal advice. Final decisions must be made by qualified legal practitioners and medical experts.",
    processedAt: new Date().toISOString()
  };
}

async function checkAttorneyConflict(
  supabaseAdmin: any,
  claimantName?: string,
  dateOfIncident?: string
): Promise<AttorneyConflict> {
  if (!claimantName) {
    return {
      hasConflict: false,
      conflictDetails: null,
      existingAttorney: null,
      existingCaseId: null
    };
  }

  // Parse claimant name
  const nameParts = claimantName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

  // Check for existing claimants with similar names
  const { data: existingClaimants, error } = await supabaseAdmin
    .from('claimants')
    .select(`
      id,
      first_name,
      last_name,
      referring_attorney_id,
      referring_attorneys (
        name,
        code
      )
    `)
    .or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%`);

  if (error || !existingClaimants || existingClaimants.length === 0) {
    return {
      hasConflict: false,
      conflictDetails: null,
      existingAttorney: null,
      existingCaseId: null
    };
  }

  // Check for potential matches
  for (const claimant of existingClaimants) {
    const fullName = `${claimant.first_name} ${claimant.last_name}`.toLowerCase();
    const searchName = claimantName.toLowerCase();
    
    // Simple similarity check
    if (fullName.includes(searchName) || searchName.includes(fullName) ||
        (claimant.first_name?.toLowerCase() === firstName.toLowerCase() && 
         claimant.last_name?.toLowerCase() === lastName.toLowerCase())) {
      
      const attorney = claimant.referring_attorneys;
      return {
        hasConflict: true,
        conflictDetails: `Claimant "${claimant.first_name} ${claimant.last_name}" found in database`,
        existingAttorney: attorney ? `${attorney.name} (${attorney.code})` : 'Unknown',
        existingCaseId: claimant.id
      };
    }
  }

  return {
    hasConflict: false,
    conflictDetails: null,
    existingAttorney: null,
    existingCaseId: null
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
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

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    console.log('Validating user token for case screening...');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error('Auth error:', userError?.message);
      throw new Error('Invalid authorization');
    }

    const userId = userData.user.id;
    console.log('User authenticated:', userId);

    const formData = await req.formData();
    const fileCount = parseInt(formData.get('fileCount') as string || '1');
    const claimantName = formData.get('claimantName') as string | null;

    // Collect all files
    const files: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File;
      if (file) {
        files.push(file);
      }
    }

    // Fallback to single file format for backwards compatibility
    if (files.length === 0) {
      const singleFile = formData.get('file') as File;
      if (singleFile) {
        files.push(singleFile);
      }
    }

    if (files.length === 0) {
      throw new Error('No files provided');
    }

    console.log(`Processing ${files.length} file(s)`);

    // Extract text from all documents
    let combinedText = '';
    const processedFiles: string[] = [];

    for (const file of files) {
      console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Read file content
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Content = btoa(binaryString);

      // Extract text from document
      const extractedText = await extractTextFromDocument(base64Content, file.type, file.name);
      
      if (extractedText && extractedText.length > 50) {
        combinedText += `\n\n=== DOCUMENT: ${file.name} ===\n\n${extractedText}`;
        processedFiles.push(file.name);
      } else {
        console.warn(`Could not extract sufficient text from: ${file.name}`);
      }
    }
    
    if (!combinedText || combinedText.length < 50) {
      throw new Error('Could not extract sufficient text from any document');
    }

    console.log(`Extracted text from ${processedFiles.length} document(s), total length: ${combinedText.length}`);

    // Analyze with AI
    const analysisResult = await analyzeWithAI(combinedText, supabaseAdmin, claimantName || undefined);

    // Add processed files info
    analysisResult.processedFiles = processedFiles;

    // Check attorney conflict
    const attorneyConflict = await checkAttorneyConflict(
      supabaseAdmin,
      claimantName || undefined,
      analysisResult.extractedFacts?.dateOfIncident || undefined
    );

    // Merge conflict check result
    analysisResult.attorneyConflict = attorneyConflict;

    console.log('Case screening completed successfully');

    return new Response(JSON.stringify({
      success: true,
      result: analysisResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Case screening error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

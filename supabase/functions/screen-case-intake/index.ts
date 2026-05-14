import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Case types - expanded
type CaseType = 'road_accident' | 'slip_and_fall' | 'medical_negligence' | 'unlawful_arrest';

interface IDVerification {
  fullName: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
  ageAtIncident: number | null;
  idType: 'green_book' | 'smart_id' | 'passport' | 'unknown';
  validationStatus: 'verified' | 'mismatch_found' | 'incomplete' | 'not_provided';
  mismatches: string[];
}

interface CaseTypeIntelligence {
  type: CaseType;
  confidence: number;
  indicators: string[];
  specificFindings: {
    // RAF specific
    motorVehicleInvolved?: boolean;
    accidentDate?: string;
    accidentLocation?: string;
    injuriesLinkedToAccident?: boolean;
    rafPrescriptionStatus?: string;
    // Slip & Fall specific
    premisesOwner?: string;
    fallLocation?: string;
    fallCause?: string;
    incidentReportAvailable?: boolean;
    negligenceIndicators?: string[];
    // Medical Negligence specific
    treatmentDates?: string[];
    healthcareProviders?: string[];
    clinicalTimeline?: string;
    standardOfCareDeviations?: string[];
    negligenceIndicatorsDetected?: string[];
  };
}

interface TimelineEvent {
  date: string;
  eventType: 'incident' | 'treatment' | 'referral' | 'admission' | 'discharge' | 'surgery' | 'consultation' | 'diagnosis';
  description: string;
  source: string;
  significance: 'critical' | 'important' | 'routine';
}

interface PrescriptionAnalysis {
  caseType: CaseType;
  incidentDate: string | null;
  prescriptionPeriodYears: number;
  expiryDate: string | null;
  daysRemaining: number | null;
  status: 'safe' | 'approaching' | 'urgent' | 'expired';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

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
  linkedToCaseType: CaseType;
}

interface ExpertRecommendation {
  expertType: string;
  reason: string;
  priority: 'mandatory' | 'recommended' | 'optional';
  urgency: 'immediate' | 'within_30_days' | 'within_90_days' | 'standard';
  linkedToInjury: string;
  linkedToCaseType: CaseType;
}

interface ViabilityDecision {
  recommendation: 'proceed' | 'proceed_with_caution' | 'do_not_proceed';
  confidence: number;
  strengthOfFacts: 'strong' | 'moderate' | 'weak';
  medicalConsistency: 'consistent' | 'some_gaps' | 'inconsistent';
  injurySeverity: 'severe' | 'moderate' | 'minor';
  documentationQuality: 'complete' | 'partial' | 'poor';
  prescriptionRisk: 'safe' | 'approaching' | 'urgent' | 'expired';
  reasons: string[];
  missingDocumentsList: string[];
  strengthAreas: string[];
  weaknessAreas: string[];
}

interface AttorneyConflict {
  hasConflict: boolean;
  conflictDetails: string | null;
  existingAttorney: string | null;
  existingCaseId: string | null;
}

interface OCRResult {
  extractedText: string;
  ocrUsed: boolean;
  totalPages: number;
  readablePages: number;
  unreadablePages: number[];
  ocrConfidence: number;
  warnings: string[];
  requiresClearerCopy: boolean;
  preservedElements: {
    pageNumbers: boolean;
    headings: boolean;
    dates: boolean;
    medicalTerms: boolean;
  };
  extractionSource: 'native_text' | 'ocr_scanned';
}

interface CaseScreeningResult {
  caseTypes: CaseType[];
  caseTypeIntelligence: CaseTypeIntelligence[];
  idVerification: IDVerification;
  timeline: TimelineEvent[];
  prescriptionAnalysis: PrescriptionAnalysis[];
  extractedFacts: ExtractedFacts;
  injuries: InjuryAnalysis[];
  expertRecommendations: ExpertRecommendation[];
  viability: ViabilityDecision;
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
  processedFiles?: string[];
  ocrInfo?: {
    filesProcessedWithOCR: string[];
    totalUnreadablePages: number;
    warnings: string[];
    requiresClearerCopy: boolean;
    extractionDetails: {
      fileName: string;
      source: 'native_text' | 'ocr_scanned';
      confidence: number;
      preservedElements: {
        pageNumbers: boolean;
        headings: boolean;
        dates: boolean;
        medicalTerms: boolean;
      };
    }[];
  };
  reviewStatus: 'pending_review' | 'approved' | 'rejected';
  extractedTextPreview?: string;
  attorneyConflict: AttorneyConflict;
}

// Prescription periods by case type (in years)
const PRESCRIPTION_PERIODS: Record<CaseType, number> = {
  road_accident: 3, // RAF claims typically 3 years
  slip_and_fall: 3, // General delict 3 years
  medical_negligence: 3, // Medical negligence 3 years
  unlawful_arrest: 3, // Constitutional claims 3 years
};

async function extractTextFromDocument(
  fileContent: string,
  fileType: string,
  fileName: string
): Promise<OCRResult> {
  const result: OCRResult = {
    extractedText: '',
    ocrUsed: false,
    totalPages: 0,
    readablePages: 0,
    unreadablePages: [],
    ocrConfidence: 100,
    warnings: [],
    requiresClearerCopy: false,
    preservedElements: {
      pageNumbers: false,
      headings: false,
      dates: false,
      medicalTerms: false
    },
    extractionSource: 'native_text'
  };

  // Check if it's a PDF that might need OCR
  if (fileType === 'application/pdf') {
    let textContent = '';
    try {
      textContent = atob(fileContent);
    } catch (e) {
      result.warnings.push(`Failed to decode PDF content for ${fileName}`);
      return result;
    }
    
    // Estimate page count from PDF markers
    const pageMatches = textContent.match(/\/Type\s*\/Page[^s]/gi) || [];
    result.totalPages = Math.max(pageMatches.length, 1);
    
    // Check if PDF has selectable text - look for meaningful text content
    const extractedLetters = textContent.replace(/[^a-zA-Z]/g, '');
    const hasSelectableText = extractedLetters.length > 500;
    
    // Check for common scanned PDF indicators
    const isLikelyScanned = 
      textContent.includes('/Image') && 
      !hasSelectableText ||
      textContent.includes('/DCTDecode') && extractedLetters.length < 1000 ||
      textContent.includes('/FlateDecode') && extractedLetters.length < 300;
    
    if (!hasSelectableText || isLikelyScanned) {
      console.log(`PDF "${fileName}" appears to be scanned (${extractedLetters.length} chars extracted). Running OCR...`);
      result.ocrUsed = true;
      result.extractionSource = 'ocr_scanned';
      
      // Use DocuPipe for OCR with FormData approach
      const docupipeApiKey = Deno.env.get('DOCUPIPE_API_KEY');
      if (docupipeApiKey) {
        try {
          console.log('Using DocuPipe OCR for scanned document...');
          
          // Convert base64 to blob for FormData
          const byteCharacters = atob(fileContent);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          
          const formData = new FormData();
          formData.append('file', blob, fileName);
          
          const response = await fetch('https://api.docupipe.com/v1/extract', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + docupipeApiKey,
            },
            body: formData,
          });
          
          if (response.ok) {
            const ocrResult = await response.json();
            let ocrText = '';
            
            // Handle different response formats
            if (ocrResult.text) {
              ocrText = ocrResult.text;
              console.log('OCR extraction successful, text length:', ocrText.length);
            } else if (ocrResult.pages && Array.isArray(ocrResult.pages)) {
              ocrText = ocrResult.pages.map((page: any, index: number) => {
                const pageText = page.text || '';
                if (pageText.length < 20) {
                  result.unreadablePages.push(index + 1);
                } else {
                  result.readablePages++;
                }
                return pageText;
              }).join('\n\n');
              console.log('OCR extraction successful from pages, text length:', ocrText.length);
            }
            
            if (ocrText && ocrText.length > 50) {
              // Post-process OCR text to preserve important elements
              ocrText = postProcessOCRText(ocrText, result);
              
              result.extractedText = ocrText;
              result.ocrConfidence = ocrResult.confidence || 85;
              
              // Analyze preserved elements
              result.preservedElements = analyzePreservedElements(ocrText);
              
              // If no page-by-page analysis, estimate based on text length
              if (!ocrResult.pages) {
                const avgCharsPerPage = ocrText.length / result.totalPages;
                if (avgCharsPerPage < 100) {
                  result.warnings.push(`Low text density detected - some pages may be unreadable`);
                  result.ocrConfidence = Math.min(result.ocrConfidence, 60);
                }
                result.readablePages = result.totalPages;
              }
              
              // Check if clearer copy is needed
              if (result.ocrConfidence < 50 || result.unreadablePages.length > result.totalPages * 0.3) {
                result.requiresClearerCopy = true;
                result.warnings.push(`Poor scan quality detected. Consider uploading clearer copies for better accuracy.`);
              }
              
              console.log(`OCR successful: ${ocrText.length} chars extracted, confidence: ${result.ocrConfidence}%`);
            } else {
              result.warnings.push(`OCR produced minimal text for ${fileName} - document may be unreadable`);
              result.extractedText = textContent;
              result.ocrConfidence = 30;
              result.requiresClearerCopy = true;
              // Mark all pages as potentially unreadable
              for (let i = 1; i <= result.totalPages; i++) {
                result.unreadablePages.push(i);
              }
            }
          } else {
            const errorText = await response.text();
            console.error('DocuPipe OCR API error:', response.status, errorText);
            result.warnings.push(`OCR service error for ${fileName} - using raw extraction`);
            result.extractedText = textContent;
            result.ocrConfidence = 20;
          }
        } catch (error) {
          console.error('DocuPipe OCR error:', error);
          result.warnings.push(`OCR failed for ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.extractedText = textContent;
          result.ocrConfidence = 20;
        }
      } else {
        // No OCR API key - use raw content and warn
        console.warn('DOCUPIPE_API_KEY not set, using raw PDF content');
        result.warnings.push(`OCR not available for scanned PDF ${fileName} - text extraction may be incomplete`);
        result.extractedText = textContent;
        result.ocrConfidence = 15;
        result.requiresClearerCopy = true;
      }
    } else {
      // PDF has selectable text, no OCR needed
      result.extractedText = textContent;
      result.readablePages = result.totalPages;
      result.extractionSource = 'native_text';
      result.preservedElements = analyzePreservedElements(textContent);
      console.log(`PDF "${fileName}" has selectable text (${extractedLetters.length} chars)`);
    }
    
    return result;
  }
  
  // Non-PDF files
  try {
    result.extractedText = atob(fileContent);
    result.totalPages = 1;
    result.readablePages = 1;
    result.preservedElements = analyzePreservedElements(result.extractedText);
  } catch (e) {
    result.warnings.push(`Failed to decode content for ${fileName}`);
  }
  
  return result;
}

// Post-process OCR text to preserve important elements
function postProcessOCRText(text: string, result: OCRResult): string {
  let processed = text;
  
  // Normalize page breaks and preserve page numbers
  processed = processed.replace(/\f/g, '\n\n--- Page Break ---\n\n');
  
  // Preserve common page number formats
  processed = processed.replace(/(?:Page|Pg\.?|P\.?)\s*(\d+)\s*(?:of\s*\d+)?/gi, '\n[Page $1]\n');
  
  // Preserve date formats commonly found in medical records
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g,  // DD/MM/YYYY, MM-DD-YY
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi,  // 01 January 2024
    /(?:Date|Dated|Date of Birth|DOB|Date of Admission|Date of Discharge)[:\s]+([^\n]+)/gi
  ];
  
  // Mark dates for preservation
  datePatterns.forEach(pattern => {
    processed = processed.replace(pattern, (match) => `【DATE: ${match}】`);
  });
  
  // Preserve common medical section headings
  const headingPatterns = [
    /^(HISTORY|DIAGNOSIS|EXAMINATION|TREATMENT|MEDICATIONS?|PROGNOSIS|FINDINGS|IMPRESSION|ASSESSMENT|PLAN|SUMMARY|CONCLUSION|RECOMMENDATION)/gim,
    /^(CHIEF COMPLAINT|PRESENTING COMPLAINT|PAST MEDICAL HISTORY|FAMILY HISTORY|SOCIAL HISTORY|ALLERGIES|VITAL SIGNS|PHYSICAL EXAMINATION)/gim,
    /^(CLINICAL NOTES?|PROGRESS NOTES?|DISCHARGE SUMMARY|OPERATION NOTES?|OPERATIVE REPORT|ADMISSION NOTES?)/gim
  ];
  
  headingPatterns.forEach(pattern => {
    processed = processed.replace(pattern, (match) => `\n\n=== ${match.toUpperCase()} ===\n`);
  });
  
  // Preserve medical terminology formatting
  const medicalTerms = [
    /\b(fracture|dislocation|contusion|laceration|abrasion|hematoma)\b/gi,
    /\b(x-ray|MRI|CT scan|ultrasound|ECG|EEG)\b/gi,
    /\b(diagnosis|prognosis|etiology|pathology)\b/gi,
    /\b(mg|ml|mcg|IU|mmHg|bpm)\b/g,
    /\b(q\.?d\.?|b\.?i\.?d\.?|t\.?i\.?d\.?|q\.?i\.?d\.?|p\.?r\.?n\.?|stat)\b/gi
  ];
  
  // Clean up excessive whitespace while preserving structure
  processed = processed.replace(/\n{4,}/g, '\n\n\n');
  processed = processed.replace(/[ \t]{3,}/g, '  ');
  
  return processed;
}

// Analyze what elements were preserved in the extracted text
function analyzePreservedElements(text: string): {
  pageNumbers: boolean;
  headings: boolean;
  dates: boolean;
  medicalTerms: boolean;
} {
  return {
    pageNumbers: /\[?Page\s*\d+\]?|--- Page Break ---/i.test(text),
    headings: /===\s*[A-Z\s]+\s*===|^[A-Z]{2,}[A-Z\s]*:/m.test(text),
    dates: /【DATE:|(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i.test(text),
    medicalTerms: /\b(fracture|diagnosis|treatment|prognosis|examination|history)\b/i.test(text)
  };
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

  const systemPrompt = `You are an expert medico-legal case screening analyst specializing in South African personal injury law. Your role is to perform comprehensive case screening for Road Accident Fund (RAF) claims, Slip and Fall incidents, Medical Negligence cases, and Unlawful Arrest/Detention cases.

CRITICAL DOCUMENT READING INSTRUCTIONS:
1. Auto-detect document types from content (medical records, ID copies, police reports, hospital notes, referral letters)
2. Extract ALL dates, names, diagnoses, and timelines with precision
3. If text appears garbled, focus on identifiable medical terms and dates
4. Label extracted content clearly by source document

CASE TYPE DEFINITIONS AND INTELLIGENCE:

🚗 RAF (Road Accident Fund) - CASE TYPE: road_accident
MUST verify:
- Motor vehicle involvement confirmed
- Extract accident date and location
- Identify injuries DIRECTLY linked to accident
- Calculate RAF prescription (3 years from accident)
- Check for pedestrian/cyclist/passenger involvement
Required experts typically: Orthopaedic Surgeon, Neurosurgeon, Occupational Therapist, Industrial Psychologist, Actuary (for loss of earnings)

🚶 SLIP AND FALL - CASE TYPE: slip_and_fall
MUST verify:
- Identify premises owner/occupier
- Extract exact location and cause of fall
- Link injuries specifically to fall incident
- Flag if incident report is MISSING
- Assess negligence indicators (wet floor, broken stairs, poor lighting, etc.)
Required experts: Orthopaedic Surgeon, General Surgeon (if surgical intervention), Occupational Therapist

⚕️ MEDICAL NEGLIGENCE - CASE TYPE: medical_negligence
MUST verify:
- Identify ALL treatment dates and healthcare providers
- Build complete clinical timeline
- Detect ANY deviations from standard of care
- Flag possible negligence indicators:
  * Delayed diagnosis
  * Wrong medication/dosage
  * Surgical errors
  * Failure to obtain informed consent
  * Inadequate monitoring
  * Misdiagnosis
  * Failure to refer
Required experts: Specialist in same field as treating doctor, Nursing Expert, Clinical Forensic Expert

⚖️ UNLAWFUL ARREST - CASE TYPE: unlawful_arrest
MUST verify:
- Date and location of arrest
- Authority involved (SAPS, Metro Police, etc.)
- Detention duration and conditions
- Evidence of assault/trauma

🆔 ID DOCUMENT VERIFICATION:
When ID documents are detected, extract:
- Full name (exactly as appears)
- ID number (13-digit South African ID)
- Date of birth
- Document type (green_book, smart_id, passport)
- Validate age against incident date
- Flag ANY mismatches between ID and medical records (name spelling, dates)

📅 TIMELINE & PRESCRIPTION CHECK:
Build a comprehensive timeline from:
- Incident date (CRITICAL)
- All treatment dates
- Referral dates
- Hospital admission/discharge dates

Automatically calculate and check:
- RAF prescription: 3 years from accident
- Delictual prescription: 3 years from incident
- Medical negligence: 3 years from when harm was discovered or reasonably should have been discovered

🎯 VIABILITY DECISION ENGINE:
Each case MUST end with one of:
- "proceed" - Strong case, recommend taking
- "proceed_with_caution" - Some issues but viable
- "do_not_proceed" - Significant problems

Provide:
- Clear reasons for decision
- Complete list of missing documents
- Strength areas
- Weakness areas

👨‍⚕️ EXPERT RECOMMENDATION ENGINE:
Based on injuries and case type:
- Indicate if expert is MANDATORY, RECOMMENDED, or OPTIONAL
- Specify urgency: immediate, within_30_days, within_90_days, standard
- Link each expert to specific injury and case type

PRESCRIPTION PERIODS (South Africa):
- Road Accident (RAF): 3 years from date of accident
- Slip and Fall: 3 years from date of incident
- Medical Negligence: 3 years from date harm was discovered
- Unlawful Arrest: 3 years from date of incident

You must respond with a valid JSON object matching the required schema.`;

  const userPrompt = `Analyze the following case documents and provide a comprehensive screening assessment with enhanced case type intelligence, ID verification, timeline analysis, and expert recommendations.

${claimantName ? `Claimant Name: ${claimantName}` : ''}

DOCUMENT CONTENT:
${text.substring(0, 120000)}

Provide your analysis as a JSON object with this exact structure:
{
  "caseTypes": ["road_accident" | "slip_and_fall" | "medical_negligence" | "unlawful_arrest"],
  "caseTypeIntelligence": [
    {
      "type": "road_accident | slip_and_fall | medical_negligence | unlawful_arrest",
      "confidence": 0-100,
      "indicators": ["indicator1", "indicator2"],
      "specificFindings": {
        "motorVehicleInvolved": true/false (for RAF),
        "accidentDate": "YYYY-MM-DD" (for RAF),
        "accidentLocation": "string" (for RAF),
        "injuriesLinkedToAccident": true/false (for RAF),
        "rafPrescriptionStatus": "string" (for RAF),
        "premisesOwner": "string" (for slip_and_fall),
        "fallLocation": "string" (for slip_and_fall),
        "fallCause": "string" (for slip_and_fall),
        "incidentReportAvailable": true/false (for slip_and_fall),
        "negligenceIndicators": ["indicator1"] (for slip_and_fall),
        "treatmentDates": ["date1", "date2"] (for medical_negligence),
        "healthcareProviders": ["provider1"] (for medical_negligence),
        "clinicalTimeline": "string" (for medical_negligence),
        "standardOfCareDeviations": ["deviation1"] (for medical_negligence),
        "negligenceIndicatorsDetected": ["indicator1"] (for medical_negligence)
      }
    }
  ],
  "idVerification": {
    "fullName": "string or null",
    "idNumber": "string or null (13-digit SA ID)",
    "dateOfBirth": "YYYY-MM-DD or null",
    "ageAtIncident": number or null,
    "idType": "green_book | smart_id | passport | unknown",
    "validationStatus": "verified | mismatch_found | incomplete | not_provided",
    "mismatches": ["mismatch description if any"]
  },
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "eventType": "incident | treatment | referral | admission | discharge | surgery | consultation | diagnosis",
      "description": "detailed description",
      "source": "document name/type",
      "significance": "critical | important | routine"
    }
  ],
  "prescriptionAnalysis": [
    {
      "caseType": "road_accident | slip_and_fall | medical_negligence | unlawful_arrest",
      "incidentDate": "YYYY-MM-DD or null",
      "prescriptionPeriodYears": 3,
      "expiryDate": "YYYY-MM-DD or null",
      "daysRemaining": number or null,
      "status": "safe | approaching | urgent | expired",
      "riskLevel": "low | medium | high | critical",
      "recommendation": "action recommendation"
    }
  ],
  "extractedFacts": {
    "dateOfIncident": "YYYY-MM-DD or null",
    "location": "string or null",
    "treatingFacility": "string or null",
    "natureOfIncident": "detailed description",
    "injuriesSustained": ["injury1", "injury2"],
    "treatmentReceived": ["treatment1", "treatment2"],
    "missingDocuments": ["document1", "document2"],
    "documentTypes": ["medical_records", "id_document", "police_report", "hospital_notes", "referral_letter", etc.]
  },
  "injuries": [
    {
      "type": "injury name",
      "category": "orthopaedic | neurological | psychological | soft_tissue | internal | other",
      "severity": "minor | moderate | severe | critical",
      "description": "detailed description",
      "linkedToCaseType": "road_accident | slip_and_fall | medical_negligence | unlawful_arrest"
    }
  ],
  "expertRecommendations": [
    {
      "expertType": "Orthopaedic Surgeon | Neurosurgeon | General Surgeon | Occupational Therapist | Clinical Psychologist | Industrial Psychologist | Psychiatrist | Actuary | Nursing Expert | Forensic Medical Practitioner | Emergency Medicine Specialist",
      "reason": "reason for recommendation",
      "priority": "mandatory | recommended | optional",
      "urgency": "immediate | within_30_days | within_90_days | standard",
      "linkedToInjury": "which injury this relates to",
      "linkedToCaseType": "which case type this relates to"
    }
  ],
  "viability": {
    "recommendation": "proceed | proceed_with_caution | do_not_proceed",
    "confidence": 0-100,
    "strengthOfFacts": "strong | moderate | weak",
    "medicalConsistency": "consistent | some_gaps | inconsistent",
    "injurySeverity": "severe | moderate | minor",
    "documentationQuality": "complete | partial | poor",
    "prescriptionRisk": "safe | approaching | urgent | expired",
    "reasons": ["detailed reason 1", "detailed reason 2"],
    "missingDocumentsList": ["specific missing document 1", "specific missing document 2"],
    "strengthAreas": ["strength 1", "strength 2"],
    "weaknessAreas": ["weakness 1", "weakness 2"]
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
      max_tokens: 12000,
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

  // Ensure all required fields have defaults
  return {
    caseTypes: analysisResult.caseTypes || [],
    caseTypeIntelligence: analysisResult.caseTypeIntelligence || [],
    idVerification: analysisResult.idVerification || {
      fullName: null,
      idNumber: null,
      dateOfBirth: null,
      ageAtIncident: null,
      idType: 'unknown',
      validationStatus: 'not_provided',
      mismatches: []
    },
    timeline: analysisResult.timeline || [],
    prescriptionAnalysis: analysisResult.prescriptionAnalysis || [],
    extractedFacts: analysisResult.extractedFacts || {
      dateOfIncident: null,
      location: null,
      treatingFacility: null,
      natureOfIncident: '',
      injuriesSustained: [],
      treatmentReceived: [],
      missingDocuments: [],
      documentTypes: []
    },
    injuries: analysisResult.injuries || [],
    expertRecommendations: analysisResult.expertRecommendations || [],
    viability: analysisResult.viability || {
      recommendation: 'proceed_with_caution',
      confidence: 50,
      strengthOfFacts: 'moderate',
      medicalConsistency: 'some_gaps',
      injurySeverity: 'moderate',
      documentationQuality: 'partial',
      prescriptionRisk: 'safe',
      reasons: [],
      missingDocumentsList: [],
      strengthAreas: [],
      weaknessAreas: []
    },
    screeningOpinion: analysisResult.screeningOpinion || {
      caseTypeSummary: '',
      factsSummary: '',
      injuriesSummary: '',
      medicalConsistency: '',
      legalIssues: [],
      finalRecommendation: ''
    },
    attorneyConflict: {
      hasConflict: false,
      conflictDetails: null,
      existingAttorney: null,
      existingCaseId: null
    },
    disclaimer: "SCREENING OPINION – Subject to Legal & Expert Review. This is an initial screening opinion only and does not constitute legal advice. Final decisions must be made by qualified legal practitioners and medical experts.",
    processedAt: new Date().toISOString(),
    reviewStatus: 'pending_review'
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

serve(withErrorHandler(async (req) => {
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

    console.log(`Processing ${files.length} file(s) for enhanced case screening`);

    // Extract text from all documents with OCR tracking
    let combinedText = '';
    const processedFiles: string[] = [];
    const ocrInfo: {
      filesProcessedWithOCR: string[];
      totalUnreadablePages: number;
      warnings: string[];
      requiresClearerCopy: boolean;
      extractionDetails: {
        fileName: string;
        source: 'native_text' | 'ocr_scanned';
        confidence: number;
        preservedElements: {
          pageNumbers: boolean;
          headings: boolean;
          dates: boolean;
          medicalTerms: boolean;
        };
      }[];
    } = {
      filesProcessedWithOCR: [],
      totalUnreadablePages: 0,
      warnings: [],
      requiresClearerCopy: false,
      extractionDetails: []
    };

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

      // Extract text from document with OCR support
      const ocrResult = await extractTextFromDocument(base64Content, file.type, file.name);
      
      // Track extraction details
      ocrInfo.extractionDetails.push({
        fileName: file.name,
        source: ocrResult.extractionSource,
        confidence: ocrResult.ocrConfidence,
        preservedElements: ocrResult.preservedElements
      });
      
      // Track OCR usage
      if (ocrResult.ocrUsed) {
        ocrInfo.filesProcessedWithOCR.push(file.name);
        console.log(`OCR applied to ${file.name}, confidence: ${ocrResult.ocrConfidence}%`);
      }
      
      // Track if clearer copy is needed
      if (ocrResult.requiresClearerCopy) {
        ocrInfo.requiresClearerCopy = true;
      }
      
      // Track unreadable pages
      if (ocrResult.unreadablePages.length > 0) {
        ocrInfo.totalUnreadablePages += ocrResult.unreadablePages.length;
        ocrInfo.warnings.push(
          `${file.name}: Pages ${ocrResult.unreadablePages.join(', ')} could not be fully read`
        );
      }
      
      // Collect all warnings
      ocrInfo.warnings.push(...ocrResult.warnings);
      
      if (ocrResult.extractedText && ocrResult.extractedText.length > 50) {
        // Auto-detect document type based on content
        const docType = detectDocumentType(ocrResult.extractedText, file.name);
        
        // Add clear labeling for OCR-extracted text
        const extractionLabel = ocrResult.ocrUsed 
          ? `[EXTRACTED FROM SCANNED DOCUMENT (OCR) - ${ocrResult.ocrConfidence}% confidence]` 
          : '[NATIVE TEXT EXTRACTION]';
        const docTypeLabel = `[DOCUMENT TYPE: ${docType}]`;
        const unreadableNote = ocrResult.unreadablePages.length > 0
          ? `\n[WARNING: Pages ${ocrResult.unreadablePages.join(', ')} may be incomplete - consider uploading clearer copies]`
          : '';
        const preservedNote = ocrResult.ocrUsed ? 
          `\n[Preserved: ${Object.entries(ocrResult.preservedElements).filter(([,v]) => v).map(([k]) => k).join(', ') || 'basic text'}]` : '';
        
        combinedText += `\n\n=== DOCUMENT: ${file.name} ===\n${docTypeLabel}\n${extractionLabel}${unreadableNote}${preservedNote}\n\n${ocrResult.extractedText}`;
        processedFiles.push(file.name);
      } else {
        console.warn(`Could not extract sufficient text from: ${file.name}`);
        ocrInfo.warnings.push(`${file.name}: Could not extract sufficient text - document may be unreadable`);
      }
    }
    
    if (!combinedText || combinedText.length < 50) {
      // Include OCR warnings in error for better debugging
      const warningText = ocrInfo.warnings.length > 0 
        ? `. OCR warnings: ${ocrInfo.warnings.join('; ')}`
        : '';
      throw new Error(`Could not extract sufficient text from any document${warningText}`);
    }

    console.log(`Extracted text from ${processedFiles.length} document(s), total length: ${combinedText.length}`);
    if (ocrInfo.filesProcessedWithOCR.length > 0) {
      console.log(`OCR applied to ${ocrInfo.filesProcessedWithOCR.length} file(s)`);
    }
    if (ocrInfo.totalUnreadablePages > 0) {
      console.log(`Total unreadable pages flagged: ${ocrInfo.totalUnreadablePages}`);
    }

    // Analyze with AI
    const analysisResult = await analyzeWithAI(combinedText, supabaseAdmin, claimantName || undefined);

    // Add processed files info and OCR info
    analysisResult.processedFiles = processedFiles;
    analysisResult.ocrInfo = ocrInfo;
    
    // Set review status - pending review for OCR documents
    analysisResult.reviewStatus = ocrInfo.filesProcessedWithOCR.length > 0 ? 'pending_review' : 'approved';
    
    // Add preview of extracted text for admin review
    analysisResult.extractedTextPreview = combinedText.substring(0, 5000) + (combinedText.length > 5000 ? '...[truncated]' : '');

    // Check attorney conflict
    const attorneyConflict = await checkAttorneyConflict(
      supabaseAdmin,
      claimantName || undefined,
      analysisResult.extractedFacts?.dateOfIncident || undefined
    );

    // Merge conflict check result
    analysisResult.attorneyConflict = attorneyConflict;

    console.log('Enhanced case screening completed successfully');

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
}));

// Auto-detect document type based on content
function detectDocumentType(text: string, fileName: string): string {
  const lowerText = text.toLowerCase();
  const lowerFileName = fileName.toLowerCase();
  
  // ID Document detection
  if (lowerText.includes('identity number') || lowerText.includes('id number') ||
      /\d{13}/.test(text) || lowerText.includes('department of home affairs') ||
      lowerFileName.includes('id') || lowerFileName.includes('passport')) {
    return 'ID_DOCUMENT';
  }
  
  // Police/Accident Report detection
  if (lowerText.includes('police report') || lowerText.includes('accident report') ||
      lowerText.includes('case number') || lowerText.includes('saps') ||
      lowerText.includes('south african police') || lowerFileName.includes('police')) {
    return 'POLICE_ACCIDENT_REPORT';
  }
  
  // Hospital/Discharge Summary detection
  if (lowerText.includes('discharge summary') || lowerText.includes('admission') ||
      lowerText.includes('hospital') || lowerText.includes('ward')) {
    return 'HOSPITAL_DISCHARGE_SUMMARY';
  }
  
  // Medical Records detection
  if (lowerText.includes('diagnosis') || lowerText.includes('treatment') ||
      lowerText.includes('patient') || lowerText.includes('examination') ||
      lowerText.includes('medical') || lowerText.includes('clinical')) {
    return 'MEDICAL_RECORDS';
  }
  
  // Referral Letter detection
  if (lowerText.includes('refer') || lowerText.includes('referral') ||
      lowerText.includes('dear doctor') || lowerText.includes('dear colleague')) {
    return 'REFERRAL_LETTER';
  }
  
  // X-Ray/Radiology detection
  if (lowerText.includes('x-ray') || lowerText.includes('radiograph') ||
      lowerText.includes('mri') || lowerText.includes('ct scan') ||
      lowerText.includes('ultrasound') || lowerText.includes('radiology')) {
    return 'RADIOLOGY_REPORT';
  }
  
  // Operation/Surgical Notes detection
  if (lowerText.includes('operation') || lowerText.includes('surgical') ||
      lowerText.includes('procedure') || lowerText.includes('anaesthe')) {
    return 'SURGICAL_NOTES';
  }
  
  return 'UNKNOWN_DOCUMENT';
}

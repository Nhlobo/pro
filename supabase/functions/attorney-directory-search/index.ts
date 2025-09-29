import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AttorneySearchParams {
  query?: string;
  province?: string;
  practice_areas?: string[];
  role?: string[];
  firm_size?: string;
  limit?: number;
}

interface AttorneyResult {
  id: string;
  name: string;
  firm: string;
  role: string;
  practice_areas: string[];
  province: string;
  city: string;
  address: string;
  phone_primary: string;
  phone_other: string[];
  email: string;
  website: string;
  bar_admission_number?: string;
  years_practicing?: number;
  seniority: string;
  source_urls: string[];
  last_verified: string;
  confidence_score: number;
  notes?: string;
  tags: string[];
}

interface GovernmentInstitution {
  province: string;
  institution: string;
  unit: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  source: string;
}

interface SearchResponse {
  query_meta: {
    query_id: string;
    timestamp: string;
    province: string;
    practice_areas: string[];
    filters: {
      role: string[];
    };
  };
  results: AttorneyResult[];
  government_institutions: GovernmentInstitution[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const searchParams: AttorneySearchParams = await req.json();
    const { query, province, practice_areas, role, firm_size, limit = 50 } = searchParams;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique query ID
    const queryId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    console.log('Attorney directory search:', { query, province, practice_areas, role });

    // Build database query
    let dbQuery = supabase
      .from('attorneys')
      .select('*')
      .eq('status', 'active');

    // Apply filters
    if (province && province !== 'all') {
      dbQuery = dbQuery.ilike('location', `%${province}%`);
    }

    if (practice_areas && practice_areas.length > 0) {
      dbQuery = dbQuery.overlaps('specialization', practice_areas);
    }

    if (query) {
      // Full-text search on name, law_firm, and specialization
      dbQuery = dbQuery.or(`name.ilike.%${query}%,law_firm.ilike.%${query}%`);
    }

    // Execute search
    const { data: attorneys, error } = await dbQuery.limit(limit);

    if (error) {
      console.error('Database search error:', error);
      throw new Error(`Database search failed: ${error.message}`);
    }

    // Transform database results to match expected format
    const processedResults: AttorneyResult[] = (attorneys || []).map((attorney: any) => ({
      id: attorney.id,
      name: attorney.name,
      firm: attorney.law_firm || 'Unknown Firm',
      role: 'General', // Default role since it's not in the attorneys table
      practice_areas: attorney.specialization || [],
      province: attorney.location || 'Unknown',
      city: 'Unknown', // Not available in current schema
      address: attorney.address || 'Not specified',
      phone_primary: attorney.phone || 'Not available',
      phone_other: [],
      email: attorney.email || 'Not available',
      website: 'Not available',
      bar_admission_number: undefined,
      years_practicing: undefined,
      seniority: 'Attorney',
      source_urls: [],
      last_verified: timestamp,
      confidence_score: 0.8, // Default confidence for database records
      notes: undefined,
      tags: attorney.status === 'potential' ? ['potential'] : []
    }));

    // Get government institutions for the province
    const governmentInstitutions = await getGovernmentInstitutions(province);

    const searchResponse: SearchResponse = {
      query_meta: {
        query_id: queryId,
        timestamp,
        province: province || 'all',
        practice_areas: practice_areas || [],
        filters: {
          role: role || []
        }
      },
      results: processedResults,
      government_institutions: governmentInstitutions
    };

    // Store search history
    if (req.headers.get('authorization')) {
      try {
        const { data: { user } } = await supabase.auth.getUser(
          req.headers.get('authorization')?.replace('Bearer ', '') || ''
        );
        
        if (user) {
          await supabase.from('lead_search_history').insert({
            search_query: query || '',
            province: province || 'all',
            lead_type: role?.[0] || 'general',
            results_found: processedResults.length,
            created_by: user.id
          });
        }
      } catch (historyError) {
        console.warn('Failed to store search history:', historyError);
      }
    }

    console.log(`Attorney search completed: ${processedResults.length} results found`);

    return new Response(
      JSON.stringify(searchResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in attorney directory search:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractAttorneyInfo(item: any) {
  const { title, snippet, link } = item;
  const text = `${title} ${snippet}`.toLowerCase();
  
  // Extract name patterns
  const namePatterns = [
    /adv\.?\s+([a-z\s]+)/i,
    /advocate\s+([a-z\s]+)/i,
    /attorney\s+([a-z\s]+)/i,
    /([a-z]+\s+[a-z]+)\s+attorneys?/i
  ];
  
  let name = '';
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      name = match[1].trim();
      break;
    }
  }
  
  // Extract contact information
  const phoneRegex = /(\+27[-\s]?\d{2}[-\s]?\d{3,4}[-\s]?\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4})/g;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  const phones = snippet.match(phoneRegex) || [];
  const emails = snippet.match(emailRegex) || [];
  
  // Extract address
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[^,]*,?\s*[A-Za-z\s]*,?\s*\d{4}/i,
    /[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*\d{4}/
  ];
  
  let address = '';
  for (const pattern of addressPatterns) {
    const match = snippet.match(pattern);
    if (match) {
      address = match[0].trim();
      break;
    }
  }
  
  // Extract firm name
  const firmPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Attorneys?|Law\s+Firm|Legal)/i,
    /([A-Z][a-z]+(?:\s+&\s+[A-Z][a-z]+)*)\s+(?:Inc|Incorporated)/i
  ];
  
  let firm = '';
  for (const pattern of firmPatterns) {
    const match = title.match(pattern);
    if (match) {
      firm = match[1].trim();
      break;
    }
  }
  
  return {
    name: name || '',
    firm: firm || '',
    phone: phones[0] || '',
    additionalPhones: phones.slice(1),
    email: emails[0] || '',
    address: address || '',
    province: extractProvince(snippet),
    city: extractCity(address || snippet),
    barNumber: extractBarNumber(snippet),
    yearsExperience: extractYearsExperience(snippet),
    notes: extractNotes(snippet)
  };
}

function extractFirmName(title: string): string {
  return title
    .replace(/\s*-.*$/, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s*Law Firm.*$/i, ' Law Firm')
    .replace(/\s*Attorney.*$/i, ' Attorney')
    .replace(/\s*Lawyer.*$/i, ' Lawyer')
    .trim();
}

function determineRole(title: string, snippet: string, requestedRoles?: string[]): string {
  const text = `${title} ${snippet}`.toLowerCase();
  
  if (text.includes('plaintiff') || text.includes('claimant')) return 'Plaintiff';
  if (text.includes('defence') || text.includes('defense')) return 'Defence';
  if (text.includes('state attorney') || text.includes('government')) return 'State';
  
  // Default to first requested role or 'General'
  return requestedRoles?.[0] || 'General';
}

function extractPracticeAreas(snippet: string, requestedAreas?: string[]): string[] {
  const text = snippet.toLowerCase();
  const areas: string[] = [];
  
  const practiceAreaMap = {
    'raf': ['raf', 'road accident fund', 'motor vehicle accident', 'mva'],
    'assault': ['assault', 'criminal', 'personal injury'],
    'medical negligence': ['medical negligence', 'malpractice', 'medical malpractice', 'healthcare']
  };
  
  for (const [area, keywords] of Object.entries(practiceAreaMap)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        areas.push(area.toUpperCase());
        break;
      }
    }
  }
  
  return areas.length > 0 ? areas : (requestedAreas || ['General']);
}

function extractSeniority(title: string, snippet: string): string {
  const text = `${title} ${snippet}`.toLowerCase();
  
  if (text.includes('partner') || text.includes('founding')) return 'Partner';
  if (text.includes('associate')) return 'Associate';
  if (text.includes('state attorney')) return 'State Attorney';
  if (text.includes('advocate') || text.includes('adv.')) return 'Advocate';
  
  return 'Attorney';
}

function extractProvince(text: string): string {
  const provinces = [
    'gauteng', 'western cape', 'kwazulu-natal', 'eastern cape',
    'limpopo', 'mpumalanga', 'north west', 'northern cape', 'free state'
  ];
  
  const lowerText = text.toLowerCase();
  for (const province of provinces) {
    if (lowerText.includes(province)) {
      return province.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  }
  
  return 'Unknown';
}

function extractCity(text: string): string {
  const cities = [
    'johannesburg', 'cape town', 'durban', 'pretoria', 'bloemfontein',
    'port elizabeth', 'pietermaritzburg', 'kimberley', 'polokwane'
  ];
  
  const lowerText = text.toLowerCase();
  for (const city of cities) {
    if (lowerText.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  
  return 'Unknown';
}

function extractBarNumber(text: string): string | undefined {
  const barPattern = /bar\s*(?:number|no\.?|#)?\s*:?\s*(\d+)/i;
  const match = text.match(barPattern);
  return match ? match[1] : undefined;
}

function extractYearsExperience(text: string): number | undefined {
  const experiencePatterns = [
    /(\d+)\s*years?\s*(?:of\s*)?experience/i,
    /(\d+)\s*years?\s*in\s*practice/i,
    /practicing\s*for\s*(\d+)\s*years?/i
  ];
  
  for (const pattern of experiencePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return undefined;
}

function extractNotes(text: string): string | undefined {
  // Look for conflicting information or special notes
  const phoneMatches = text.match(/(\+27[-\s]?\d{2}[-\s]?\d{3,4}[-\s]?\d{4}|\d{3}[-\s]?\d{3}[-\s]?\d{4})/g);
  
  if (phoneMatches && phoneMatches.length > 1) {
    return `Multiple phone numbers found: ${phoneMatches.join(', ')} — all retained`;
  }
  
  return undefined;
}

function calculateConfidenceScore(extractedInfo: any): number {
  let score = 0.5; // Base score
  
  if (extractedInfo.name) score += 0.2;
  if (extractedInfo.firm) score += 0.15;
  if (extractedInfo.phone && extractedInfo.phone !== 'Not available') score += 0.1;
  if (extractedInfo.email && extractedInfo.email !== 'Not available') score += 0.1;
  if (extractedInfo.address) score += 0.05;
  
  return Math.min(score, 1.0);
}

function generateTags(extractedInfo: any, item: any): string[] {
  const tags: string[] = [];
  
  // Determine if new or established
  if (extractedInfo.yearsExperience) {
    if (extractedInfo.yearsExperience < 5) tags.push('new');
    else if (extractedInfo.yearsExperience > 15) tags.push('established');
  }
  
  // Check for state attorney
  if (item.title.toLowerCase().includes('state attorney') || 
      item.snippet.toLowerCase().includes('state attorney')) {
    tags.push('state-attorney');
  }
  
  // Check for firm size indicators
  if (item.snippet.toLowerCase().includes('large') || 
      item.snippet.toLowerCase().includes('big')) {
    tags.push('large-firm');
  }
  
  return tags;
}

async function getGovernmentInstitutions(province?: string): Promise<GovernmentInstitution[]> {
  // Predefined government institutions by province
  const institutions: { [key: string]: GovernmentInstitution[] } = {
    'gauteng': [{
      province: 'Gauteng',
      institution: 'Department of Justice and Constitutional Development',
      unit: 'State Attorney (Gauteng)',
      address: '22 Pritchard Street, Johannesburg, 2001',
      phone: '+27 11 406-4000',
      email: 'info.gauteng@justice.gov.za',
      website: 'https://www.justice.gov.za',
      source: 'https://www.justice.gov.za/contact/gauteng.html'
    }],
    'western cape': [{
      province: 'Western Cape',
      institution: 'Department of Justice and Constitutional Development',
      unit: 'State Attorney (Western Cape)',
      address: '4 Adderley Street, Cape Town, 8001',
      phone: '+27 21 469-6000',
      email: 'info.westerncape@justice.gov.za',
      website: 'https://www.justice.gov.za',
      source: 'https://www.justice.gov.za/contact/western-cape.html'
    }],
    'kwazulu-natal': [{
      province: 'KwaZulu-Natal',
      institution: 'Department of Justice and Constitutional Development',
      unit: 'State Attorney (KwaZulu-Natal)',
      address: '270 Anton Lembede Street, Durban, 4001',
      phone: '+27 31 372-3000',
      email: 'info.kzn@justice.gov.za',
      website: 'https://www.justice.gov.za',
      source: 'https://www.justice.gov.za/contact/kzn.html'
    }]
  };
  
  if (province && province !== 'all') {
    return institutions[province.toLowerCase()] || [];
  }
  
  // Return all institutions if no province specified
  return Object.values(institutions).flat();
}
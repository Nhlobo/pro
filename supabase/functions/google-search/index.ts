import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

interface SearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, province, leadType } = await req.json();
    
    if (!query) {
      throw new Error('Search query is required');
    }

    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    if (!apiKey) {
      throw new Error('Google Search API key not configured');
    }

    if (!searchEngineId) {
      throw new Error('Google Search Engine ID not configured. Please add GOOGLE_SEARCH_ENGINE_ID to your secrets.');
    }

    // Build search query with location and specialization
    let searchQuery = query;
    if (province) {
      searchQuery += ` ${province} attorney`;
    }
    if (leadType === 'plaintiff_attorney') {
      searchQuery += ' plaintiff lawyer';
    } else if (leadType === 'defense_attorney') {
      searchQuery += ' defense lawyer';
    }

    console.log('Searching for:', searchQuery);

    // Make request to Google Custom Search API
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Search API error:', errorText);
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data: SearchResponse = await response.json();
    
    console.log('Search results found:', data.searchInformation?.totalResults || 0);

    // Process results to extract attorney information
    const processedResults = (data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      // Try to extract firm name from title
      firmName: extractFirmName(item.title),
      // Try to extract contact info from snippet
      contactInfo: extractContactInfo(item.snippet),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        results: processedResults,
        totalResults: data.searchInformation?.totalResults || '0',
        query: searchQuery,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in google-search function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function extractFirmName(title: string): string {
  // Remove common suffixes and clean up the title
  const cleaned = title
    .replace(/\s*-.*$/, '') // Remove everything after dash
    .replace(/\s*\|.*$/, '') // Remove everything after pipe
    .replace(/\s*Law Firm.*$/i, ' Law Firm')
    .replace(/\s*Attorney.*$/i, ' Attorney')
    .replace(/\s*Lawyer.*$/i, ' Lawyer')
    .trim();
  
  return cleaned || title;
}

function extractContactInfo(snippet: string): {
  phone?: string;
  email?: string;
  address?: string;
} {
  const phoneRegex = /(\(?\d{3}\)?\s*[-.\s]?\d{3}[-.\s]?\d{4})/g;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  const phoneMatch = snippet.match(phoneRegex);
  const emailMatch = snippet.match(emailRegex);
  
  return {
    phone: phoneMatch ? phoneMatch[0] : undefined,
    email: emailMatch ? emailMatch[0] : undefined,
    address: extractAddress(snippet),
  };
}

function extractAddress(snippet: string): string | undefined {
  // Look for patterns that might be addresses
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)/i,
    /\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+/,
  ];
  
  for (const pattern of addressPatterns) {
    const match = snippet.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return undefined;
}
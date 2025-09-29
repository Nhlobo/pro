import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AttorneySearchParams {
  query?: string;
  province?: string;
  practice_areas?: string[];
  role?: string[];
  firm_size?: string;
  limit?: number;
}

export interface AttorneyResult {
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

export interface GovernmentInstitution {
  province: string;
  institution: string;
  unit: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  source: string;
}

export interface AttorneySearchResponse {
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

export const useAttorneySearch = () => {
  const [results, setResults] = useState<AttorneyResult[]>([]);
  const [governmentInstitutions, setGovernmentInstitutions] = useState<GovernmentInstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMetadata, setSearchMetadata] = useState<any>(null);
  const { toast } = useToast();

  const searchAttorneys = async (params: AttorneySearchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: searchError } = await supabase.functions.invoke(
        'attorney-directory-search',
        {
          body: params
        }
      );

      if (searchError) {
        throw new Error(searchError.message);
      }

      const response: AttorneySearchResponse = data;
      
      setResults(response.results || []);
      setGovernmentInstitutions(response.government_institutions || []);
      setSearchMetadata(response.query_meta);

      // Store search history
      await storeSearchHistory(params, response.results.length);

      toast({
        title: "Search completed",
        description: `Found ${response.results.length} attorneys matching your criteria.`,
      });

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to search attorneys';
      setError(errorMessage);
      toast({
        title: "Search Error",
        description: "Failed to search attorney directory. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const storeSearchHistory = async (params: AttorneySearchParams, resultsFound: number) => {
    try {
      const { error } = await supabase
        .from('lead_search_history')
        .insert({
          search_query: params.query || '',
          province: params.province || 'all',
          lead_type: params.role?.[0] || 'general',
          results_found: resultsFound,
          created_by: (await supabase.auth.getUser()).data.user?.id || '',
        });

      if (error) {
        console.warn('Failed to store search history:', error);
      }
    } catch (err) {
      console.warn('Error storing search history:', err);
    }
  };

  const clearResults = () => {
    setResults([]);
    setGovernmentInstitutions([]);
    setSearchMetadata(null);
    setError(null);
  };

  return {
    results,
    governmentInstitutions,
    searchMetadata,
    loading,
    error,
    searchAttorneys,
    clearResults,
  };
};
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface FAQArticle {
  id: string;
  question: string;
  answer: string;
  category: string;
  target_audience: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const FAQ_KEY = ['faq-articles'] as const;

const REQUEST_TIMEOUT_MS = 20_000;
const ROW_CAP = 500;

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('Request timed out')), ms);
  return controller.signal;
}

/**
 * Knowledge-base data layer. react-query backed so the Support Hub
 * overview and the Knowledge Base workspace share one request, with a
 * bounded timeout and a surfaced error instead of an endless spinner.
 */
export const useFAQ = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: FAQ_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faq_articles')
        .select('*')
        .order('sort_order', { ascending: true })
        .range(0, ROW_CAP - 1)
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS));

      if (error) throw error;
      return (data as unknown as FAQArticle[]) || [];
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: FAQ_KEY });
  }, [queryClient]);

  const fetchArticles = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const createArticle = async (article: { question: string; answer: string; category: string; target_audience: string }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('faq_articles')
      .insert({ ...article, created_by: user.id } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating FAQ', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'FAQ article created' });
    invalidate();
    return data;
  };

  const updateArticle = async (id: string, updates: Partial<FAQArticle>) => {
    const { error } = await supabase.from('faq_articles').update({ ...updates, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) {
      toast({ title: 'Error updating FAQ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'FAQ updated' });
      invalidate();
    }
  };

  const deleteArticle = async (id: string) => {
    const { error } = await supabase.from('faq_articles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'FAQ deleted' });
      invalidate();
    }
  };

  return {
    articles: data || [],
    loading,
    error: error as Error | null,
    fetchArticles,
    createArticle,
    updateArticle,
    deleteArticle,
  };
};

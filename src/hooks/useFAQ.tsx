import { useState, useEffect, useCallback } from 'react';
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

export const useFAQ = () => {
  const [articles, setArticles] = useState<FAQArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faq_articles')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      toast({ title: 'Error loading FAQ', description: error.message, variant: 'destructive' });
    } else {
      setArticles((data as any[]) || []);
    }
    setLoading(false);
  }, [toast]);

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
    fetchArticles();
    return data;
  };

  const updateArticle = async (id: string, updates: Partial<FAQArticle>) => {
    const { error } = await supabase.from('faq_articles').update({ ...updates, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) {
      toast({ title: 'Error updating FAQ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'FAQ updated' });
      fetchArticles();
    }
  };

  const deleteArticle = async (id: string) => {
    const { error } = await supabase.from('faq_articles').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'FAQ deleted' });
      fetchArticles();
    }
  };

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  return { articles, loading, fetchArticles, createArticle, updateArticle, deleteArticle };
};

// src/components/admin/support-hub/KnowledgeBaseWorkspace.tsx
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, HelpCircle, Search } from 'lucide-react';
import { useFAQ } from '@/hooks/useFAQ';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'reports', label: 'Reports' },
  { value: 'payments', label: 'Payments' },
  { value: 'documents', label: 'Documents' },
  { value: 'technical', label: 'Technical' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'attorneys', label: 'Attorneys' },
  { value: 'experts', label: 'Experts' },
];

/**
 * Knowledge Base workspace: same `useFAQ` data layer as before (create /
 * delete calls unchanged), restructured with a search + category filter
 * toolbar in front of the grouped accordions instead of always rendering
 * every category — a library of a few dozen articles stays a quick scan
 * instead of a long scroll.
 */
const KnowledgeBaseWorkspace: React.FC = () => {
  const { articles, loading, createArticle, deleteArticle } = useFAQ();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', target_audience: 'all' });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const handleCreate = async () => {
    if (!form.question || !form.answer) return;
    await createArticle(form);
    setForm({ question: '', answer: '', category: 'general', target_audience: 'all' });
    setOpen(false);
  };

  const filtered = useMemo(() => articles.filter(a => {
    const q = search.toLowerCase();
    const matchesSearch = !q || a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [articles, search, categoryFilter]);

  const grouped = useMemo(() => filtered.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, typeof articles>), [filtered]);

  const categoriesInUse = useMemo(
    () => Array.from(new Set(articles.map(a => a.category))),
    [articles],
  );

  if (loading) {
    return <AdminCard><AdminLoadingState label="Loading FAQ articles…" /></AdminCard>;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <AdminCard>
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search questions and answers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-none border-black/15 pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-none border-black/15 sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesInUse.map(c => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="shrink-0 rounded-none bg-black text-white hover:bg-black/90" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New FAQ
          </Button>
        </div>
        <div className="border-t border-black/10 px-3 py-1.5 text-[11px] text-slate-400">
          {articles.length} FAQ article{articles.length === 1 ? '' : 's'} across {categoriesInUse.length} categor{categoriesInUse.length === 1 ? 'y' : 'ies'}
        </div>
      </AdminCard>

      {/* Grouped articles */}
      {Object.keys(grouped).length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={HelpCircle}
            title={articles.length === 0 ? 'No FAQ articles yet' : 'No articles match your filters'}
            description={articles.length === 0
              ? 'Build a knowledge base to reduce repeat support tickets.'
              : 'Try a different search term or category.'}
          />
        </AdminCard>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, items]) => (
            <AdminCard key={category}>
              <AdminCardHeader
                icon={HelpCircle}
                title={<span className="capitalize">{category}</span>}
                actions={<AdminPill tone="neutral">{items.length}</AdminPill>}
              />
              <AdminCardBody className="pt-1">
                <Accordion type="multiple" className="w-full">
                  {items.map(item => (
                    <AccordionItem key={item.id} value={item.id} className="border-black/10">
                      <AccordionTrigger className="text-left text-sm hover:no-underline">
                        <div className="flex flex-1 items-center gap-2">
                          <span className="text-black">{item.question}</span>
                          <AdminPill tone="neutral" className="ml-auto mr-2">{item.target_audience}</AdminPill>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 text-sm text-slate-500">{item.answer}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 rounded-none text-destructive hover:bg-destructive/10"
                            onClick={() => deleteArticle(item.id)}
                            aria-label="Delete FAQ article"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AdminCardBody>
            </AdminCard>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg">
          <SheetHeader className="border-b border-black/10 px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-black">
              <HelpCircle className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              Create FAQ Article
            </SheetTitle>
            <SheetDescription>Add a question and answer to the shared knowledge base.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 px-5 py-4">
            <Input
              placeholder="Question"
              value={form.question}
              onChange={e => setForm({ ...form, question: e.target.value })}
              className="rounded-none border-black/15"
            />
            <Textarea
              placeholder="Answer"
              value={form.answer}
              onChange={e => setForm({ ...form, answer: e.target.value })}
              rows={5}
              className="rounded-none border-black/15"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.target_audience} onValueChange={v => setForm({ ...form, target_audience: v })}>
                <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="Audience" /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full rounded-none bg-black text-white hover:bg-black/90"
              onClick={handleCreate}
              disabled={!form.question || !form.answer}
            >
              Create FAQ Article
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default KnowledgeBaseWorkspace;

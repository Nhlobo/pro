// src/components/admin/support-hub/AnnouncementsWorkspace.tsx
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Plus, Eye, EyeOff, Trash2, Megaphone, Search } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import {
  AdminCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

const PRIORITY_TONE: Record<string, PillTone> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'warning',
  urgent: 'destructive',
};

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'attorneys', label: 'Attorneys Only' },
  { value: 'experts', label: 'Experts Only' },
  { value: 'internal', label: 'Internal Staff' },
];

/**
 * Announcements workspace: same `useAnnouncements` data layer as before
 * (untouched — create/publish/delete calls are identical), restructured
 * around a filter toolbar (search + audience + status) instead of a bare
 * list, so a growing announcement history stays easy to scan.
 */
const AnnouncementsWorkspace: React.FC = () => {
  const { announcements, loading, createAnnouncement, publishAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', target_audience: 'all', priority: 'normal' });
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const handleCreate = async () => {
    if (!form.title || !form.content) return;
    await createAnnouncement(form);
    setForm({ title: '', content: '', target_audience: 'all', priority: 'normal' });
    setOpen(false);
  };

  const filtered = useMemo(() => announcements.filter(a => {
    const q = search.toLowerCase();
    const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    const matchesAudience = audienceFilter === 'all' || a.target_audience === audienceFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'published' ? a.is_published : !a.is_published);
    return matchesSearch && matchesAudience && matchesStatus;
  }), [announcements, search, audienceFilter, statusFilter]);

  if (loading) {
    return <AdminCard><AdminLoadingState label="Loading announcements…" /></AdminCard>;
  }

  const published = announcements.filter(a => a.is_published).length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <AdminCard>
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search announcements…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-none border-black/15 pl-8"
              />
            </div>
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="rounded-none border-black/15 sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Audiences</SelectItem>
                {AUDIENCE_OPTIONS.filter(a => a.value !== 'all').map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="rounded-none border-black/15 sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Published + Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="shrink-0 rounded-none bg-black text-white hover:bg-black/90" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Announcement
          </Button>
        </div>
        <div className="border-t border-black/10 px-3 py-1.5 text-[11px] text-slate-400">
          {announcements.length} announcement{announcements.length === 1 ? '' : 's'} · {published} published
        </div>
      </AdminCard>

      {/* List */}
      {filtered.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={Megaphone}
            title={announcements.length === 0 ? 'No announcements yet' : 'No announcements match your filters'}
            description={announcements.length === 0
              ? 'Create one to notify experts and attorneys of platform news.'
              : 'Try a different search term or reset the filters above.'}
          />
        </AdminCard>
      ) : (
        <AdminCard className="divide-y divide-black/10">
          {filtered.map(a => (
            <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 shrink-0" style={{ color: BRAND_TEAL }} />
                  <span className="text-sm font-medium text-black">{a.title}</span>
                  <AdminPill tone={PRIORITY_TONE[a.priority] || 'neutral'}>{a.priority}</AdminPill>
                  <AdminPill tone="neutral">{a.target_audience}</AdminPill>
                  <AdminPill tone={a.is_published ? 'success' : 'neutral'}>{a.is_published ? 'Published' : 'Draft'}</AdminPill>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500">{a.content}</p>
                <p className="mt-1 text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-none hover:bg-black/5"
                  onClick={() => publishAnnouncement(a.id, !a.is_published)}
                  aria-label={a.is_published ? 'Unpublish' : 'Publish'}
                >
                  {a.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-none text-destructive hover:bg-destructive/10"
                  onClick={() => deleteAnnouncement(a.id)}
                  aria-label="Delete announcement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </AdminCard>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg">
          <SheetHeader className="border-b border-black/10 px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-black">
              <Megaphone className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              Create Announcement
            </SheetTitle>
            <SheetDescription>Publish instantly or save as a draft to review later.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 px-5 py-4">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="rounded-none border-black/15"
            />
            <Textarea
              placeholder="Content"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="rounded-none border-black/15"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.target_audience} onValueChange={v => setForm({ ...form, target_audience: v })}>
                <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="Audience" /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full rounded-none bg-black text-white hover:bg-black/90"
              onClick={handleCreate}
              disabled={!form.title || !form.content}
            >
              Create Announcement
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AnnouncementsWorkspace;

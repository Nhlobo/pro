import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Eye, EyeOff, Trash2, Megaphone } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';

const AdminAnnouncementManager: React.FC = () => {
  const { announcements, loading, createAnnouncement, publishAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', target_audience: 'all', priority: 'normal' });

  const handleCreate = async () => {
    if (!form.title || !form.content) return;
    await createAnnouncement(form);
    setForm({ title: '', content: '', target_audience: 'all', priority: 'normal' });
    setOpen(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{announcements.length} announcements</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Announcement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Content" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.target_audience} onValueChange={v => setForm({ ...form, target_audience: v })}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="attorneys">Attorneys Only</SelectItem>
                    <SelectItem value="experts">Experts Only</SelectItem>
                    <SelectItem value="internal">Internal Staff</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {announcements.map(a => (
          <Card key={a.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground text-sm">{a.title}</span>
                    <Badge variant="outline" className="text-xs">{a.target_audience}</Badge>
                    <Badge variant={a.is_published ? 'default' : 'secondary'} className="text-xs">
                      {a.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => publishAnnouncement(a.id, !a.is_published)}>
                    {a.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteAnnouncement(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {announcements.length === 0 && <p className="text-center text-muted-foreground py-8">No announcements yet</p>}
      </div>
    </div>
  );
};

export default AdminAnnouncementManager;

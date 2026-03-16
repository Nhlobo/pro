import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Plus, Trash2, HelpCircle } from 'lucide-react';
import { useFAQ } from '@/hooks/useFAQ';

const AdminFAQManager: React.FC = () => {
  const { articles, loading, createArticle, deleteArticle } = useFAQ();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', target_audience: 'all' });

  const handleCreate = async () => {
    if (!form.question || !form.answer) return;
    await createArticle(form);
    setForm({ question: '', answer: '', category: 'general', target_audience: 'all' });
    setOpen(false);
  };

  const grouped = articles.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, typeof articles>);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{articles.length} FAQ articles</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New FAQ</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create FAQ Article</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Question" value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
              <Textarea placeholder="Answer" value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} rows={4} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="appointments">Appointments</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                    <SelectItem value="payments">Payments</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.target_audience} onValueChange={v => setForm({ ...form, target_audience: v })}>
                  <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="attorneys">Attorneys</SelectItem>
                    <SelectItem value="experts">Experts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground text-sm capitalize">{category}</span>
              <Badge variant="outline" className="text-xs">{items.length}</Badge>
            </div>
            <Accordion type="multiple" className="w-full">
              {items.map(item => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-sm text-left">
                    <div className="flex items-center gap-2 flex-1">
                      {item.question}
                      <Badge variant="outline" className="text-[9px] ml-auto mr-2">{item.target_audience}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-muted-foreground flex-1">{item.answer}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-2" onClick={() => deleteArticle(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))}
      {articles.length === 0 && <p className="text-center text-muted-foreground py-8">No FAQ articles yet</p>}
    </div>
  );
};

export default AdminFAQManager;
